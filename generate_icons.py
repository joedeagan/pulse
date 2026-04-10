"""Generate professional PWA icons for PULSE prediction market dashboard.
Uses only Python standard library (struct, zlib) to create PNG files.
"""
import struct
import zlib
import math
import os

def create_png(width, height, pixels):
    """Create a PNG file from RGBA pixel data."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT chunk - raw pixel data with filter bytes
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter: none
        for x in range(width):
            idx = (y * width + x) * 4
            raw_data += bytes(pixels[idx:idx+4])

    compressed = zlib.compress(raw_data, 9)
    idat = make_chunk(b'IDAT', compressed)

    # IEND chunk
    iend = make_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend


def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB colors."""
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def draw_icon(size):
    """Generate icon pixel data at given size."""
    pixels = [0] * (size * size * 4)
    cx, cy = size / 2, size / 2
    radius = size / 2

    # Colors
    bg_outer = (6, 6, 11)       # #06060b
    bg_inner = (13, 13, 21)     # #0d0d15
    cyan = (0, 214, 143)        # #00d68f
    blue = (0, 136, 255)        # #0088ff

    # Corner radius for rounded square (proportion of size)
    corner_r = size * 0.18

    def in_rounded_rect(x, y, margin=0):
        """Check if point is inside the rounded rectangle."""
        left = margin
        right = size - margin
        top = margin
        bottom = size - margin
        cr = corner_r - margin * 0.5
        if cr < 0:
            cr = 0

        # Check if inside the rounded rect
        if left + cr <= x <= right - cr and top <= y <= bottom:
            return True
        if left <= x <= right and top + cr <= y <= bottom - cr:
            return True
        # Check corners
        corners = [
            (left + cr, top + cr),
            (right - cr, top + cr),
            (left + cr, bottom - cr),
            (right - cr, bottom - cr),
        ]
        for ccx, ccy in corners:
            if (x - ccx) ** 2 + (y - ccy) ** 2 <= cr ** 2:
                return True
        return False

    def rounded_rect_sdf(x, y, margin=0):
        """Signed distance to rounded rect edge (negative = inside)."""
        left = margin
        right = size - margin
        top = margin
        bottom = size - margin
        cr = max(corner_r - margin * 0.5, 0)

        # Distance to axis-aligned box with rounded corners
        # Shift to center of box
        bcx = (left + right) / 2
        bcy = (top + bottom) / 2
        hw = (right - left) / 2
        hh = (bottom - top) / 2

        dx = abs(x - bcx) - hw + cr
        dy = abs(y - bcy) - hh + cr

        if dx > 0 and dy > 0:
            return math.sqrt(dx*dx + dy*dy) - cr
        else:
            return max(dx, dy) - cr

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4

            # Distance from center (normalized 0-1)
            dx = (x - cx) / radius
            dy = (y - cy) / radius
            dist_center = math.sqrt(dx*dx + dy*dy)

            # Check if inside rounded rect
            sdf = rounded_rect_sdf(x + 0.5, y + 0.5)

            if sdf > 0.7:
                # Outside - transparent
                pixels[idx] = 0
                pixels[idx+1] = 0
                pixels[idx+2] = 0
                pixels[idx+3] = 0
                continue

            # Anti-aliased edge
            edge_alpha = max(0, min(1, 0.7 - sdf))

            # Background: subtle radial gradient
            bg_t = min(1, dist_center * 0.7)
            bg = lerp_color(bg_inner, bg_outer, bg_t)

            # --- Draw pulse rings ---
            ring_radius_1 = 0.82
            ring_radius_2 = 0.68
            ring_width = 0.018

            ring_alpha = 0.0

            # Outer ring
            ring_dist_1 = abs(dist_center - ring_radius_1)
            if ring_dist_1 < ring_width * 3:
                a = max(0, 1 - ring_dist_1 / (ring_width * 3))
                ring_alpha = max(ring_alpha, a * 0.25)

            # Inner ring
            ring_dist_2 = abs(dist_center - ring_radius_2)
            if ring_dist_2 < ring_width * 2:
                a = max(0, 1 - ring_dist_2 / (ring_width * 2))
                ring_alpha = max(ring_alpha, a * 0.15)

            # Ring color based on angle for gradient effect
            angle = math.atan2(dy, dx)
            ring_t = (math.sin(angle * 1.5) + 1) / 2
            ring_color = lerp_color(cyan, blue, ring_t)

            # Blend ring onto background
            r = int(bg[0] * (1 - ring_alpha) + ring_color[0] * ring_alpha)
            g = int(bg[1] * (1 - ring_alpha) + ring_color[1] * ring_alpha)
            b = int(bg[2] * (1 - ring_alpha) + ring_color[2] * ring_alpha)

            # --- Draw the "P" letter ---
            # Normalized coordinates relative to center (-1 to 1)
            nx = dx
            ny = dy

            # P letter geometry (designed for the icon)
            p_alpha = 0.0

            # P vertical stem
            stem_left = -0.22
            stem_right = -0.06
            stem_top = -0.42
            stem_bottom = 0.42
            stem_round = 0.04

            # P bowl (the curved part)
            bowl_cx = 0.02
            bowl_cy = -0.14
            bowl_rx = 0.28  # horizontal radius
            bowl_ry = 0.26  # vertical radius
            bowl_thickness = 0.16

            # Check stem with rounded ends
            if stem_left <= nx <= stem_right:
                if stem_top + stem_round <= ny <= stem_bottom - stem_round:
                    p_alpha = 1.0
                elif stem_top <= ny <= stem_top + stem_round:
                    # Top rounded end
                    cdx = (nx - (stem_left + stem_right)/2) / ((stem_right - stem_left)/2)
                    cdy = (ny - (stem_top + stem_round)) / stem_round
                    if cdx*cdx + cdy*cdy <= 1.2:
                        p_alpha = 1.0
                elif stem_bottom - stem_round <= ny <= stem_bottom:
                    # Bottom rounded end
                    cdx = (nx - (stem_left + stem_right)/2) / ((stem_right - stem_left)/2)
                    cdy = (ny - (stem_bottom - stem_round)) / stem_round
                    if cdx*cdx + cdy*cdy <= 1.2:
                        p_alpha = 1.0

            # Anti-alias stem edges
            stem_aa = 0.02
            if stem_top <= ny <= stem_bottom:
                d_left = (nx - stem_left) / stem_aa
                d_right = (stem_right - nx) / stem_aa
                if -1 < d_left < 1:
                    p_alpha = max(p_alpha, (d_left + 1) / 2)
                if -1 < d_right < 1:
                    p_alpha = max(p_alpha, (d_right + 1) / 2)

            # Check bowl (elliptical ring)
            edx = (nx - bowl_cx) / bowl_rx
            edy = (ny - bowl_cy) / bowl_ry
            bowl_dist = math.sqrt(edx*edx + edy*edy)

            # Only draw the right side of the bowl (nx >= stem_left)
            outer_edge = 1.0
            inner_edge = 1.0 - bowl_thickness / bowl_rx

            if nx >= (stem_left + stem_right) / 2:
                if inner_edge - 0.08 < bowl_dist < outer_edge + 0.08:
                    if bowl_dist <= outer_edge and bowl_dist >= inner_edge:
                        p_alpha = 1.0
                    elif bowl_dist > outer_edge:
                        aa = max(0, 1 - (bowl_dist - outer_edge) / 0.06)
                        p_alpha = max(p_alpha, aa)
                    elif bowl_dist < inner_edge:
                        aa = max(0, 1 - (inner_edge - bowl_dist) / 0.06)
                        p_alpha = max(p_alpha, aa)

            # Connection: fill between stem and bowl
            if stem_right - 0.04 <= nx <= bowl_cx + bowl_rx * 0.3:
                # Top connection
                if bowl_cy - bowl_ry * 0.95 <= ny <= bowl_cy - bowl_ry * 0.95 + bowl_thickness * 1.1:
                    p_alpha = 1.0
                # Bottom connection
                if bowl_cy + bowl_ry * 0.95 - bowl_thickness * 1.1 <= ny <= bowl_cy + bowl_ry * 0.95:
                    p_alpha = 1.0

            p_alpha = min(1.0, p_alpha)

            if p_alpha > 0:
                # Gradient on the P: top-left cyan to bottom-right blue
                grad_t = (nx + ny + 0.84) / 1.68  # normalize to 0-1
                grad_t = max(0, min(1, grad_t))
                p_color = lerp_color(cyan, blue, grad_t)

                # Add subtle glow around the P
                glow_alpha = 0
                if p_alpha < 1.0 and p_alpha > 0:
                    glow_alpha = p_alpha * 0.5

                # Blend P onto background+ring
                final_r = int(r * (1 - p_alpha) + p_color[0] * p_alpha)
                final_g = int(g * (1 - p_alpha) + p_color[1] * p_alpha)
                final_b = int(b * (1 - p_alpha) + p_color[2] * p_alpha)
                r, g, b = final_r, final_g, final_b

            # --- Subtle glow behind the P ---
            glow_radius = 0.55
            glow_dist = math.sqrt((nx + 0.05)**2 + ny**2)
            if glow_dist < glow_radius and p_alpha < 0.5:
                glow_strength = (1 - glow_dist / glow_radius) ** 2 * 0.12
                glow_color = lerp_color(cyan, blue, 0.4)
                r = min(255, int(r + glow_color[0] * glow_strength))
                g = min(255, int(g + glow_color[1] * glow_strength))
                b = min(255, int(b + glow_color[2] * glow_strength))

            # Clamp and set
            alpha = int(edge_alpha * 255)
            pixels[idx] = max(0, min(255, r))
            pixels[idx+1] = max(0, min(255, g))
            pixels[idx+2] = max(0, min(255, b))
            pixels[idx+3] = alpha

    return pixels


def main():
    base_dir = r'C:\Users\brian\Desktop\market-dashboard'

    for size in [192, 512]:
        print(f"Generating {size}x{size} icon...")
        pixels = draw_icon(size)
        png_data = create_png(size, size, pixels)
        path = os.path.join(base_dir, f'icon-{size}.png')
        with open(path, 'wb') as f:
            f.write(png_data)
        print(f"  Saved: {path} ({len(png_data)} bytes)")

    print("Done!")


if __name__ == '__main__':
    main()
