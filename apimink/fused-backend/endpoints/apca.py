import math
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/apca", tags=["UI / Accessibility"])

class APCARequest(BaseModel):
    text_color: str  # HEX
    bg_color: str    # HEX
    generate_tonal_range: bool = False

def hex_to_linear(hex_str: str):
    hex_str = hex_str.lstrip('#')
    rgb = [int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    # Convert to linear sRGB
    return [((c + 0.055) / 1.055)**2.4 if c > 0.04045 else c / 12.92 for c in rgb]

def get_luminance(linear_rgb):
    # Standard relative luminance coefficients
    r, g, b = linear_rgb
    return 0.2126729 * r + 0.7151522 * g + 0.0721750 * b

def apca_contrast(txt_hex, bg_hex):
    # Simplified APCA (SAPC) implementation
    y_txt = get_luminance(hex_to_linear(txt_hex))
    y_bg = get_luminance(hex_to_linear(bg_hex))
    
    # APCA constants
    main_trc = 1.6114473
    s_rev = 0.5714286 # 4/7
    
    # Bridge-rectification
    def clamp(val):
        return val if val > 0.0005 else 0.0
        
    y_txt_clamped = clamp(y_txt)
    y_bg_clamped = clamp(y_bg)
    
    if abs(y_bg - y_txt) < 0.0005:
        return 0.0
        
    # Contrast Calculation (Simplified for demonstration)
    if y_bg > y_txt: # Light background
        lc = (y_bg**0.56 - y_txt**0.57) * 161.8
    else: # Dark background
        lc = (y_bg**0.62 - y_txt**0.65) * 161.8
        
    return round(lc, 2)

@router.post("")
async def calculate_apca(request: APCARequest):
    contrast = apca_contrast(request.text_color, request.bg_color)
    
    # Simple tonal range by adjusting lightness in Oklab-like fashion
    tonal_range = []
    if request.generate_tonal_range:
        # Mocking tonal range by linear interpolation for now to keep it deterministic
        # in a production environment, we'd use true Oklab Lch adjustments
        for i in range(1, 10):
            factor = i / 10.0
            tonal_range.append({
                "opacity": factor,
                "contrast_with_bg": apca_contrast(request.text_color, request.bg_color) * factor
            })

    return {
        "contrast_score": contrast,
        "accessibility": {
            "body_text_pass": abs(contrast) >= 60,
            "large_text_pass": abs(contrast) >= 45,
            "fluent_ui_standard": "Pass" if abs(contrast) >= 60 else "Fail"
        },
        "tonal_range": tonal_range if request.generate_tonal_range else None
    }
