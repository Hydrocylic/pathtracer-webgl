
precision highp float;
precision highp sampler2D;
layout(location = 0) out highp vec4 pc_fragColor;

uniform sampler2D uSrcTex;
uniform int uDebugMode;

void main() {
  vec3 c = texelFetch(uSrcTex, ivec2(gl_FragCoord.xy), 0).rgb;
  if (uDebugMode > 0) {
    pc_fragColor = vec4(c, 1.0);
  } else {
    pc_fragColor = vec4(sqrt(c), 1.0);
  }
}
