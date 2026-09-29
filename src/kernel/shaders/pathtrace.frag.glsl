
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp isampler2D;
precision highp usampler2D;
layout(location = 0) out highp vec4 pc_fragColor;

uniform vec2 uResolution;
uniform mat4 uCameraWorldMatrix;
uniform mat4 uInvProjectionMatrix;
uniform vec3 uBackground;
uniform vec4 uObjects[8];
uniform vec4 uAlbedos[8];
uniform vec4 uEmissions[8];
uniform int uObjectCount;
uniform vec4 uLightQuads[32];
uniform vec4 uLightQuadEmissions[8];
uniform int uLightQuadCount;
uniform sampler2D uBvhBoundsTex;
uniform usampler2D uBvhContentsTex;
uniform sampler2D uBvhPositionTex;
uniform sampler2D uBvhNormalTex;
uniform sampler2D uBvhUvTex;
uniform usampler2D uBvhIndexTex;
uniform sampler2D uBvhTriInfoTex;
uniform sampler2D uAtlasTex0;
uniform sampler2D uAtlasTex1;
uniform int uTriCount;
uniform int uTexEnabled;
uniform int uUseBvh;
uniform int uSpp;
uniform int uMaxBounces;
uniform int uFrame;
uniform int uDebugMode;
uniform int uUseNee;
uniform sampler2D uAccumTex;
uniform float uAccumCount;

varying vec2 vUv;

#define INFINITY 1e20
#define TRI_INTERSECT_EPSILON 1e-5
#define RAY_OFFSET 1e-4
#define BVH_STACK_DEPTH 64

const float PI = 3.14159265359;
const int MAT_LAMBERT = 0;
const int MAT_MIRROR = 1;
const int MAT_GLASS = 2;

struct Ray {
  vec3 origin;
  vec3 direction;
};

struct Hit {
  float t;
  vec3 normal;
  vec3 albedo;
  vec3 emission;
  float neeHandled;
  float matType;
};

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

uvec4 uTexelFetch1D(usampler2D tex, uint index) {
  uint width = uint(textureSize(tex, 0).x);
  uvec2 uv = uvec2(index % width, index / width);
  return texelFetch(tex, ivec2(uv), 0);
}

vec4 texelFetch1D(sampler2D tex, uint index) {
  uint width = uint(textureSize(tex, 0).x);
  uvec2 uv = uvec2(index % width, index / width);
  return texelFetch(tex, ivec2(uv), 0);
}

bool intersectsBounds(vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist) {
  vec3 invDir = 1.0 / rayDirection;
  vec3 tMinPlane = invDir * (boundsMin - rayOrigin);
  vec3 tMaxPlane = invDir * (boundsMax - rayOrigin);
  vec3 tMinHit = min(tMaxPlane, tMinPlane);
  vec3 tMaxHit = max(tMaxPlane, tMinPlane);
  vec2 t = max(tMinHit.xx, tMinHit.yz);
  float t0 = max(t.x, t.y);
  t = min(tMaxHit.xx, tMaxHit.yz);
  float t1 = min(t.x, t.y);
  dist = max(t0, 0.0);
  return t1 >= dist;
}

bool intersectsTriangle(
  vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
  out vec3 barycoord, out vec3 norm, out float dist, out float side
) {
  vec3 edge1 = b - a;
  vec3 edge2 = c - a;
  norm = cross(edge1, edge2);
  float det = -dot(rayDirection, norm);
  float invdet = 1.0 / det;
  vec3 AO = rayOrigin - a;
  vec3 DAO = cross(AO, rayDirection);
  vec4 uvt;
  uvt.x = dot(edge2, DAO) * invdet;
  uvt.y = -dot(edge1, DAO) * invdet;
  uvt.z = dot(AO, norm) * invdet;
  uvt.w = 1.0 - uvt.x - uvt.y;
  barycoord = uvt.wxy;
  dist = uvt.z;
  side = sign(det);
  norm = side * normalize(norm);
  uvt += vec4(TRI_INTERSECT_EPSILON);
  return all(greaterThanEqual(uvt, vec4(0.0)));
}

bool intersectTriangles(uint offset, uint count, Ray ray, inout float minDistance, inout Hit h) {
  bool found = false;
  for (uint i = offset, l = offset + count; i < l; i++) {
    uvec3 indices = uTexelFetch1D(uBvhIndexTex, i).xyz;
    vec3 a = texelFetch1D(uBvhPositionTex, indices.x).xyz;
    vec3 b = texelFetch1D(uBvhPositionTex, indices.y).xyz;
    vec3 c = texelFetch1D(uBvhPositionTex, indices.z).xyz;
    vec3 barycoord, norm;
    float dist, side;
    if (
      intersectsTriangle(ray.origin, ray.direction, a, b, c, barycoord, norm, dist, side) &&
      dist < minDistance
    ) {
      found = true;
      minDistance = dist;
      vec4 info = texelFetch1D(uBvhTriInfoTex, i * 2u);
      float texLayer = texelFetch1D(uBvhTriInfoTex, i * 2u + 1u).x;
      h.t = dist;

      vec3 nSmooth =
        texelFetch1D(uBvhNormalTex, indices.x).xyz * barycoord.x +
        texelFetch1D(uBvhNormalTex, indices.y).xyz * barycoord.y +
        texelFetch1D(uBvhNormalTex, indices.z).xyz * barycoord.z;
      h.normal = dot(nSmooth, nSmooth) < 1e-8 ? norm : normalize(nSmooth);
      h.normal = dot(h.normal, norm) < 0.0 ? -h.normal : h.normal;
      h.albedo = info.rgb;

      if (texLayer >= 0.0 && uTexEnabled == 1 && (uDebugMode == 0 || uDebugMode == 2)) {
        vec2 uv =
          texelFetch1D(uBvhUvTex, indices.x).xy * barycoord.x +
          texelFetch1D(uBvhUvTex, indices.y).xy * barycoord.y +
          texelFetch1D(uBvhUvTex, indices.z).xy * barycoord.z;

        vec3 texel = texLayer < 64.0 ? textureLod(uAtlasTex0, uv, 0.0).rgb : textureLod(uAtlasTex1, uv, 0.0).rgb;
        h.albedo *= pow(texel, vec3(2.2));
      }
      h.matType = info.w;
      h.emission = vec3(0.0);
      h.neeHandled = 0.0;
    }
  }
  return found;
}

bool intersectBVH(Ray ray, inout Hit h, out int steps) {
  int pointer = 0;
  uint stack[BVH_STACK_DEPTH];
  stack[0] = 0u;
  float triangleDistance = h.t;
  bool found = false;
  steps = 0;
  while (pointer > -1 && pointer < BVH_STACK_DEPTH) {
    uint currNodeIndex = stack[pointer];
    pointer--;
    steps++;
    float boundsHitDistance;
    vec3 bmin = texelFetch1D(uBvhBoundsTex, currNodeIndex * 2u).xyz;
    vec3 bmax = texelFetch1D(uBvhBoundsTex, currNodeIndex * 2u + 1u).xyz;
    if (
      !intersectsBounds(ray.origin, ray.direction, bmin, bmax, boundsHitDistance) ||
      boundsHitDistance > triangleDistance
    ) {
      continue;
    }
    uvec2 boundsInfo = uTexelFetch1D(uBvhContentsTex, currNodeIndex).xy;
    bool isLeaf = bool(boundsInfo.x & 0xffff0000u);
    if (isLeaf) {
      uint count = boundsInfo.x & 0x0000ffffu;
      uint offset = boundsInfo.y;
      if (intersectTriangles(offset, count, ray, triangleDistance, h)) found = true;
    } else {
      uint leftIndex = currNodeIndex + 1u;
      uint splitAxis = boundsInfo.x & 0x0000ffffu;
      uint rightIndex = currNodeIndex + boundsInfo.y;
      bool leftToRight = ray.direction[splitAxis] >= 0.0;
      uint c1 = leftToRight ? leftIndex : rightIndex;
      uint c2 = leftToRight ? rightIndex : leftIndex;
      pointer++;
      stack[pointer] = c2;
      pointer++;
      stack[pointer] = c1;
    }
  }
  return found;
}

bool intersectTrianglesLinear(Ray ray, inout Hit h) {
  bool found = false;
  float minDistance = h.t;
  for (int i = 0; i < 65536; i++) {
    if (i >= uTriCount) break;
    uvec3 indices = uTexelFetch1D(uBvhIndexTex, uint(i)).xyz;
    vec3 a = texelFetch1D(uBvhPositionTex, indices.x).xyz;
    vec3 b = texelFetch1D(uBvhPositionTex, indices.y).xyz;
    vec3 c = texelFetch1D(uBvhPositionTex, indices.z).xyz;
    vec3 barycoord, norm;
    float dist, side;
    if (
      intersectsTriangle(ray.origin, ray.direction, a, b, c, barycoord, norm, dist, side) &&
      dist < minDistance
    ) {
      found = true;
      minDistance = dist;
      vec4 info = texelFetch1D(uBvhTriInfoTex, uint(i) * 2u);
      float texLayer = texelFetch1D(uBvhTriInfoTex, uint(i) * 2u + 1u).x;
      h.t = dist;

      vec3 nSmooth =
        texelFetch1D(uBvhNormalTex, indices.x).xyz * barycoord.x +
        texelFetch1D(uBvhNormalTex, indices.y).xyz * barycoord.y +
        texelFetch1D(uBvhNormalTex, indices.z).xyz * barycoord.z;
      h.normal = dot(nSmooth, nSmooth) < 1e-8 ? norm : normalize(nSmooth);
      h.normal = dot(h.normal, norm) < 0.0 ? -h.normal : h.normal;
      h.albedo = info.rgb;

      if (texLayer >= 0.0 && uTexEnabled == 1 && (uDebugMode == 0 || uDebugMode == 2)) {
        vec2 uv =
          texelFetch1D(uBvhUvTex, indices.x).xy * barycoord.x +
          texelFetch1D(uBvhUvTex, indices.y).xy * barycoord.y +
          texelFetch1D(uBvhUvTex, indices.z).xy * barycoord.z;

        vec3 texel = texLayer < 64.0 ? textureLod(uAtlasTex0, uv, 0.0).rgb : textureLod(uAtlasTex1, uv, 0.0).rgb;
        h.albedo *= pow(texel, vec3(2.2));
      }
      h.matType = info.w;
      h.emission = vec3(0.0);
      h.neeHandled = 0.0;
    }
  }
  return found;
}

bool intersectQuad(vec3 v0, vec3 v1, vec3 v2, vec3 v3, vec3 emission, Ray ray, inout Hit h) {
  vec3 e0 = v1 - v0;
  vec3 e1 = v3 - v0;
  vec3 n = normalize(cross(e0, e1));
  float denom = dot(n, ray.direction);
  if (abs(denom) < 1e-8) return false;
  float t = dot(v0 - ray.origin, n) / denom;
  if (t < RAY_OFFSET || t >= h.t) return false;
  vec3 d = ray.origin + ray.direction * t - v0;
  vec3 pvec = cross(ray.direction, e1);
  float det = dot(e0, pvec);
  if (abs(det) < 1e-8) return false;
  float invDet = 1.0 / det;
  float u = dot(d, pvec) * invDet;
  if (u < 0.0 || u > 1.0) return false;
  vec3 qvec = cross(d, e0);
  float v = dot(ray.direction, qvec) * invDet;
  if (v < 0.0 || v > 1.0) return false;
  if (dot(n, ray.direction) > 0.0) n = -n;
  h.t = t;
  h.normal = n;
  h.albedo = vec3(0.0);
  h.matType = 0.0;
  h.emission = emission;
  h.neeHandled = 1.0;
  return true;
}

bool intersectScene(Ray ray, inout Hit h) {
  h.t = INFINITY;
  bool hit = false;

  for (int i = 0; i < 8; i++) {
    if (i >= uObjectCount) break;
    vec4 s = uObjects[i];
    vec3 oc = (ray.origin - s.xyz) / s.w;
    vec3 d = ray.direction / s.w;
    float a = dot(d, d);
    float b = dot(d, oc);
    float c = dot(oc, oc) - 1.0;
    float disc = b * b - a * c;
    if (disc < 0.0) continue;
    disc = sqrt(disc);
    float t = (-b - disc) / a;
    if (t < RAY_OFFSET) t = (-b + disc) / a;
    if (t >= RAY_OFFSET && t < h.t) {
      h.t = t;
      h.normal = normalize(oc + d * t);
      h.albedo = uAlbedos[i].xyz;
      h.matType = uAlbedos[i].w;
      h.emission = uEmissions[i].xyz;
      h.neeHandled = 0.0;
      hit = true;
    }
  }

  int dummySteps;
  bool hitTri = (uUseBvh == 1) ? intersectBVH(ray, h, dummySteps) : intersectTrianglesLinear(ray, h);

  bool hitQuad = false;
  for (int i = 0; i < 8; i++) {
    if (i >= uLightQuadCount) break;
    vec4 c0 = uLightQuads[i * 4];
    vec4 c1 = uLightQuads[i * 4 + 1];
    vec4 c2 = uLightQuads[i * 4 + 2];
    vec4 c3 = uLightQuads[i * 4 + 3];
    if (intersectQuad(c0.xyz, c1.xyz, c2.xyz, c3.xyz, uLightQuadEmissions[i].xyz, ray, h)) hitQuad = true;
  }
  return hit || hitTri || hitQuad;
}

vec3 sampleCosineHemisphere(vec2 uv, vec3 normal) {
  float r = sqrt(uv.x);
  float phi = 6.28318530718 * uv.y;
  vec3 local = vec3(r * cos(phi), sqrt(max(0.0, 1.0 - uv.x)), r * sin(phi));
  vec3 up = abs(normal.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, normal));
  vec3 bitangent = cross(normal, tangent);
  return tangent * local.x + normal * local.y + bitangent * local.z;
}

vec3 sampleQuadLight(vec3 p, vec3 n, vec3 albedo, vec2 rng, int lightIndex) {
  vec4 c0 = uLightQuads[lightIndex * 4];
  vec4 c1 = uLightQuads[lightIndex * 4 + 1];
  vec4 c2 = uLightQuads[lightIndex * 4 + 2];
  vec4 c3 = uLightQuads[lightIndex * 4 + 3];
  vec3 e0 = c1.xyz - c0.xyz;
  vec3 e1 = c3.xyz - c0.xyz;
  vec3 lightN = normalize(cross(e0, e1));
  float area = length(cross(e0, e1));
  vec3 pl = c0.xyz + rng.x * e0 + rng.y * e1;
  vec3 w = pl - p;
  float distSq = dot(w, w);
  float dist = sqrt(distSq);
  vec3 wl = w / dist;
  float cosP = dot(wl, n);
  float cosL = dot(-wl, lightN);
  if (cosP <= 0.0 || cosL <= 0.0) return vec3(0.0);

  Ray shadowRay = Ray(p + n * RAY_OFFSET, wl);
  Hit sh;
  if (intersectScene(shadowRay, sh) && sh.t < dist - RAY_OFFSET) return vec3(0.0);
  vec3 Le = uLightQuadEmissions[lightIndex].xyz;
  return Le * albedo * (cosP * cosL * area / distSq) * (1.0 / PI);
}

vec3 ndcToRayOrigin(vec2 coord) {
  vec4 rayOrigin4 = uCameraWorldMatrix * uInvProjectionMatrix * vec4(coord, -1.0, 1.0);
  return rayOrigin4.xyz / rayOrigin4.w;
}

Ray getCameraRay(vec2 jitteredUv) {
  vec2 ndc = 2.0 * jitteredUv - 1.0;
  Ray ray;
  ray.origin = ndcToRayOrigin(ndc);
  ray.direction = normalize(mat3(uCameraWorldMatrix) * (uInvProjectionMatrix * vec4(ndc, 0.0, 1.0)).xyz);
  return ray;
}

vec3 tracePath(Ray ray, vec2 rng) {
  vec3 radiance = vec3(0.0);
  vec3 throughput = vec3(1.0);
  bool prevDidNee = false;

  for (int bounce = 0; bounce < 16; bounce++) {
    if (bounce >= uMaxBounces) break;

    Hit h;
    if (!intersectScene(ray, h)) {
      radiance += throughput * uBackground;
      break;
    }

    vec3 pos = ray.origin + ray.direction * h.t;
    if (h.emission.r + h.emission.g + h.emission.b > 0.0) {

      if (uUseNee == 0 || h.neeHandled < 0.5 || !prevDidNee) radiance += throughput * h.emission;
      break;
    }

    vec3 dir;
    int bounceMat = int(h.matType + 0.5);
    if (bounceMat == MAT_MIRROR) {
      dir = reflect(ray.direction, h.normal);
    } else if (bounceMat == MAT_GLASS) {
      float cosI = dot(ray.direction, h.normal);
      float eta = (cosI < 0.0) ? (1.0 / 1.5) : 1.5;
      float cosT2 = 1.0 - eta * eta * (1.0 - cosI * cosI);
      bool totalReflect = cosT2 <= 0.0;
      float F = totalReflect ? 1.0 : (0.04 + 0.96 * pow(1.0 - abs(cosI), 5.0));
      if (hash13(vec3(rng, 3.0)) < F) {
        dir = reflect(ray.direction, h.normal);
      } else {
        dir = refract(ray.direction, h.normal, eta);
      }
    } else {

      if (uUseNee == 1) {
        for (int li = 0; li < 8; li++) {
          if (li >= uLightQuadCount) break;
          vec2 lrng = vec2(hash13(vec3(rng, 5.0 + float(li))), hash13(vec3(rng, 9.0 + float(li))));
          radiance += throughput * sampleQuadLight(pos, h.normal, h.albedo, lrng, li);
        }
      }
      dir = sampleCosineHemisphere(rng, h.normal);
    }
    prevDidNee = (uUseNee == 1) && (bounceMat == MAT_LAMBERT);
    throughput *= h.albedo;

    float q = clamp(max(throughput.r, max(throughput.g, throughput.b)), 0.05, 0.95);
    if (hash13(vec3(rng, float(bounce) * 0.618)) > q) break;
    throughput /= q;

    rng = vec2(hash13(vec3(rng, 1.0)), hash13(vec3(rng, 2.0)));
    ray = Ray(pos + h.normal * RAY_OFFSET, dir);
  }
  return radiance;
}

void main() {
  vec3 color = vec3(0.0);

  vec3 dbgNormal = vec3(0.0);
  vec3 dbgAlbedo = vec3(0.0);
  float dbgDist = -1.0;
  int dbgSteps = 0;
  if (uDebugMode > 0) {
    Ray dbgRay = getCameraRay(vUv);
    Hit dh;
    if (uDebugMode == 5) {

      dh.t = INFINITY;
      if (uUseBvh == 1) {
        intersectBVH(dbgRay, dh, dbgSteps);
      } else {
        dbgSteps = uTriCount;
      }
      if (dh.t < INFINITY) {
        dbgNormal = dh.normal;
        dbgAlbedo = dh.albedo;
        dbgDist = dh.t;
      }
    } else if (intersectScene(dbgRay, dh)) {
      dbgNormal = dh.normal;
      dbgAlbedo = dh.albedo;
      dbgDist = dh.t;
    }
  }

  if (uDebugMode == 0) {
    vec2 ssd = vec2(1.0) / uResolution;
    for (int s = 0; s < 64; s++) {
      if (s >= uSpp) break;
      float r1 = hash13(vec3(gl_FragCoord.xy, float(s) * 7.31 + float(uFrame)));
      float r2 = hash13(vec3(gl_FragCoord.xy + 31.7, float(s) * 3.17 + float(uFrame)));
      Ray ray = getCameraRay(vUv + vec2(r1 - 0.5, r2 - 0.5) * ssd);
      color += tracePath(ray, vec2(r1, r2));
    }
    color /= float(uSpp);
  }

  if (uDebugMode == 1) {
    color = dbgNormal * 0.5 + 0.5;
  } else if (uDebugMode == 2) {
    color = dbgAlbedo;
  } else if (uDebugMode == 3) {
    color = vec3(dbgDist / 20.0);
  } else if (uDebugMode == 4) {
    color = (dbgDist < 0.0) ? vec3(1.0, 0.0, 1.0) : vec3(0.0);
  } else if (uDebugMode == 5) {

    float t = clamp(float(dbgSteps) / 64.0, 0.0, 1.0);
    vec3 heat = mix(vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), clamp(t * 2.0, 0.0, 1.0));
    heat = mix(heat, vec3(1.0, 0.0, 0.0), clamp(t * 2.0 - 1.0, 0.0, 1.0));
    color = heat;
  } else {

    vec3 prev = texelFetch(uAccumTex, ivec2(gl_FragCoord.xy), 0).rgb;
    color = mix(prev, color, 1.0 / (uAccumCount + 1.0));
  }
  pc_fragColor = vec4(color, 1.0);
}
