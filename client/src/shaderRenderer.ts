/**
 * The WebGL2 side of ShaderCanvas: compiles the "AI in progress" shader into a canvas and
 * animates it until stopped. Stopping releases the context outright (loseContext), not just
 * its program: browsers cap live WebGL contexts at ~16 and only reclaim a dropped canvas's
 * context at garbage collection, so remounted shaders used to pile up until surfaces went
 * black (docs/AUDIT.md #12).
 */
const VERT_SRC = `#version 300 es
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Recolored port of https://www.shadertoy.com/view/DdcfzH — its stock amber/blue/pink/
 * purple palette is swapped for the app's locked acid/sky/lilac/amber hues so the "AI in
 * progress" motion exception (docs/design/DESIGN.md#Motion) doesn't introduce new colors. */
const FRAG_SRC = `#version 300 es
precision mediump float;
uniform vec3 iResolution;
uniform float iTime;
out vec4 outColor;

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
  return fract(sin(p) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
  return 0.5 + 0.5 * n;
}

float grain(vec2 uv) {
  return length(hash(uv));
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float aspect = iResolution.x / iResolution.y;
  vec2 tuv = uv - 0.5;

  float degree = noise(vec2(iTime * 0.05, tuv.x * tuv.y));
  tuv.y /= aspect;
  tuv *= rot(radians((degree - 0.5) * 720.0 + 180.0));
  tuv.y *= aspect;

  float frequency = 5.0;
  float amplitude = 30.0;
  float speed = iTime * 2.0;
  tuv.x += sin(tuv.y * frequency + speed) / amplitude;
  tuv.y += sin(tuv.x * frequency * 1.5 + speed) / (amplitude * 0.5);

  vec3 acid = vec3(0.831, 1.0, 0.0);
  vec3 sky = vec3(0.188, 0.737, 0.929);
  vec3 lilac = vec3(0.482, 0.294, 0.580);
  vec3 amber = vec3(0.233, 0.160, 0.75);

  vec3 layer1 = mix(lilac, sky, smoothstep(-0.3, 0.2, (tuv * rot(radians(-5.0))).x));
  vec3 layer2 = mix(amber, acid, smoothstep(-0.3, 0.2, (tuv * rot(radians(-5.0))).x));
  vec3 color = mix(layer1, layer2, smoothstep(0.5, -0.3, tuv.y));

  color -= grain(uv) * 0.1;
  outColor = vec4(color, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Program = { program: WebGLProgram; shaders: WebGLShader[] };

function createProgram(gl: WebGL2RenderingContext): Program | null {
  const shaders = [compile(gl, gl.VERTEX_SHADER, VERT_SRC), compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC)]
    .filter((s): s is WebGLShader => s !== null);
  const program = shaders.length === 2 ? gl.createProgram() : null;
  if (!program) {
    shaders.forEach((s) => gl.deleteShader(s));
    return null;
  }
  shaders.forEach((s) => gl.attachShader(program, s));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    shaders.forEach((s) => gl.deleteShader(s));
    return null;
  }
  return { program, shaders };
}

/** Draw the shader into `canvas` until the returned stop function runs. A canvas whose
 * context was released can't get a working one back, so each start needs a fresh canvas. */
export function startShader(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl2');
  if (!gl) return () => {};
  const release = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
  const built = createProgram(gl);
  if (!built) {
    release();
    return () => {};
  }
  const { program, shaders } = built;
  gl.useProgram(program);
  const iResolution = gl.getUniformLocation(program, 'iResolution');
  const iTime = gl.getUniformLocation(program, 'iTime');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    canvas.width = Math.max(1, Math.round(clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(iResolution, canvas.width, canvas.height, 1);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let raf = 0;
  const start = performance.now();
  const draw = (now: number) => {
    gl.uniform1f(iTime, reduceMotion ? 0 : (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduceMotion) raf = requestAnimationFrame(draw);
  };
  draw(start);

  return () => {
    observer.disconnect();
    if (raf) cancelAnimationFrame(raf);
    gl.deleteProgram(program);
    shaders.forEach((s) => gl.deleteShader(s));
    release();
  };
}
