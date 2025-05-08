export default /*glsl*/ `\
#version 300 es
#pragma vscode_glsllint_stage: frag

float getPointOnLine(vec2 p0, vec2 p1, float x)
{
    float slope = (p0.y - p1.y) / (p0.x - p1.x);
    return slope * (x - p0.x) + p0.y;
}

uniform float u_type; // 0: arrow, 1: rectangle

in vec4 v_pickColor;
in vec4 v_color;
in vec2  v_st;

void main()
{
    vec2 st = v_st;

    float base = 1.0 - abs(fwidth(st.s)) * 10.0 * czm_pixelRatio;

    vec2 center = vec2(1.0, 0.5);

    float ptOnUpperLine = 1.0;
    float ptOnLowerLine = 0.0;

    if(u_type == 0.) {
        ptOnUpperLine = getPointOnLine(vec2(base, 1.0), center, st.s);
        ptOnLowerLine = getPointOnLine(vec2(base, 0.0), center, st.s);
    }

    float halfWidth = 0.15;
    float s = step(0.5 - halfWidth, st.t);
    s *= 1.0 - step(0.5 + halfWidth, st.t);
    s *= 1.0 - step(base, st.s);

    float t = step(base, st.s);
    t *= 1.0 - step(ptOnUpperLine, st.t);
    t *= step(ptOnLowerLine, st.t);

    // Find the distance from the closest separator (region between two colors)
    float dist;
    if (st.s < base)
    {
        float d1 = abs(st.t - (0.5 - halfWidth));
        float d2 = abs(st.t - (0.5 + halfWidth));
        dist = min(d1, d2);
    }
    else
    {
        float d1 = czm_infinity;
        if (st.t < 0.5 - halfWidth && st.t > 0.5 + halfWidth)
        {
            d1 = abs(st.s - base);
        }
        float d2 = abs(st.t - ptOnUpperLine);
        float d3 = abs(st.t - ptOnLowerLine);
        dist = min(min(d1, d2), d3);
    }

    vec4 outsideColor = vec4(0.0);
    vec4 currentColor = mix(outsideColor, v_color, clamp(s + t, 0.0, 1.0));
    vec4 outColor = czm_antialias(outsideColor, v_color, currentColor, dist);

    outColor = czm_gammaCorrect(outColor);

    out_FragColor = outColor * v_color;

    czm_writeLogDepth();

}
`;
