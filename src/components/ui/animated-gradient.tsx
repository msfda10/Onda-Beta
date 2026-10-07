import { useRef, useEffect, useMemo, useState, CSSProperties } from "react";

type PatternShape = "Checks" | "Stripes" | "Edge";

const PatternShapes: Record<PatternShape, number> = {
  Checks: 0,
  Stripes: 1,
  Edge: 2,
};

interface PresetParams {
  color1: string;
  color2: string;
  color3: string;
  rotation: number;
  proportion: number;
  scale: number;
  speed: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  softness: number;
  offset: number;
  shape: PatternShape;
  shapeSize: number;
}

export const presets: Record<PresetName, PresetParams> = {
  Prism: {
    color1: "#05070e",
    color2: "#3b82f6",
    color3: "#60a5fa",
    rotation: -45,
    proportion: 35,
    scale: 0.02,
    speed: 12,
    distortion: 6,
    swirl: 45,
    swirlIterations: 14,
    softness: 65,
    offset: 0,
    shape: "Checks",
    shapeSize: 45,
  },
  Lava: {
    color1: "#FF9F21",
    color2: "#FF0303",
    color3: "#000000",
    rotation: 114,
    proportion: 100,
    scale: 0.52,
    speed: 14,
    distortion: 7,
    swirl: 18,
    swirlIterations: 20,
    softness: 100,
    offset: 717,
    shape: "Edge",
    shapeSize: 12,
  },
  Plasma: {
    color1: "#B566FF",
    color2: "#000000",
    color3: "#000000",
    rotation: 0,
    proportion: 63,
    scale: 0.75,
    speed: 14,
    distortion: 5,
    swirl: 61,
    swirlIterations: 5,
    softness: 100,
    offset: -168,
    shape: "Checks",
    shapeSize: 28,
  },
  Pulse: {
    color1: "#66FF85",
    color2: "#000000",
    color3: "#000000",
    rotation: -167,
    proportion: 92,
    scale: 0,
    speed: 12,
    distortion: 54,
    swirl: 75,
    swirlIterations: 3,
    softness: 28,
    offset: -813,
    shape: "Checks",
    shapeSize: 79,
  },
  Vortex: {
    color1: "#000000",
    color2: "#FFFFFF",
    color3: "#000000",
    rotation: 50,
    proportion: 41,
    scale: 0.4,
    speed: 12,
    distortion: 0,
    swirl: 100,
    swirlIterations: 3,
    softness: 5,
    offset: -744,
    shape: "Stripes",
    shapeSize: 80,
  },
  Mist: {
    color1: "#050505",
    color2: "#FF66B8",
    color3: "#050505",
    rotation: 0,
    proportion: 33,
    scale: 0.48,
    speed: 15,
    distortion: 4,
    swirl: 65,
    swirlIterations: 5,
    softness: 100,
    offset: -235,
    shape: "Edge",
    shapeSize: 48,
  },
};

export type PresetName = "Prism" | "Lava" | "Plasma" | "Pulse" | "Vortex" | "Mist";

export interface CustomConfig {
  preset: "custom";
  color1: string;
  color2: string;
  color3: string;
  rotation?: number;
  proportion?: number;
  scale?: number;
  speed?: number;
  distortion?: number;
  swirl?: number;
  swirlIterations?: number;
  softness?: number;
  offset?: number;
  shape?: PatternShape;
  shapeSize?: number;
}

export interface PresetConfig {
  preset: PresetName;
  speed?: number;
}

export type GradientConfig = CustomConfig | PresetConfig;

export interface NoiseConfig {
  opacity: number;
  scale?: number;
}

export interface AnimatedGradientProps {
  config?: GradientConfig;
  noise?: NoiseConfig;
  radius?: string;
  style?: CSSProperties;
  className?: string;
  lowRes?: boolean;
  children?: React.ReactNode;
}

export default function AnimatedGradient({
  config = { preset: "Prism" },
  noise,
  radius = "0px",
  style,
  className,
  lowRes = false,
  children,
}: AnimatedGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameIdRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(performance.now());

  // Estado ULTRA SUAVE: inércia líquida contínua que nunca dá tranco nem volta seca quando o mouse para
  const pointerFlowRef = useRef<{
    rawX: number;
    rawY: number;
    smoothX: number;
    smoothY: number;
    driftOffsetX: number;
    driftOffsetY: number;
    velX: number;
    velY: number;
  }>({
    rawX: 0.5,
    rawY: 0.5,
    smoothX: 0.5,
    smoothY: 0.5,
    driftOffsetX: 0,
    driftOffsetY: 0,
    velX: 0,
    velY: 0,
  });

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const params = useMemo((): PresetParams => {
    if (config.preset === "custom") {
      return {
        color1: config.color1,
        color2: config.color2,
        color3: config.color3,
        rotation: config.rotation ?? 0,
        proportion: config.proportion ?? 35,
        scale: config.scale ?? 1,
        speed: config.speed ?? 12,
        distortion: config.distortion ?? 12,
        swirl: config.swirl ?? 80,
        swirlIterations: config.swirlIterations ?? 10,
        softness: config.softness ?? 100,
        offset: config.offset ?? 0,
        shape: config.shape ?? "Checks",
        shapeSize: config.shapeSize ?? 10,
      };
    }
    const preset = presets[config.preset] || presets.Prism;
    return {
      ...preset,
      speed: config.speed ?? preset.speed,
    };
  }, [
    config.preset,
    (config as CustomConfig).color1,
    (config as CustomConfig).color2,
    (config as CustomConfig).color3,
    (config as CustomConfig).speed,
    (config as CustomConfig).rotation,
    (config as CustomConfig).distortion,
    (config as CustomConfig).swirl,
    (config as CustomConfig).shape,
  ]);

  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !isMounted) return;

    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vertexShaderSource = `#version 300 es
    in vec4 a_position;
    void main() {
      gl_Position = a_position;
    }`;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      u_time: gl.getUniformLocation(program, "u_time"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
      u_scale: gl.getUniformLocation(program, "u_scale"),
      u_rotation: gl.getUniformLocation(program, "u_rotation"),
      u_color1: gl.getUniformLocation(program, "u_color1"),
      u_color2: gl.getUniformLocation(program, "u_color2"),
      u_color3: gl.getUniformLocation(program, "u_color3"),
      u_proportion: gl.getUniformLocation(program, "u_proportion"),
      u_softness: gl.getUniformLocation(program, "u_softness"),
      u_shape: gl.getUniformLocation(program, "u_shape"),
      u_shapeScale: gl.getUniformLocation(program, "u_shapeScale"),
      u_distortion: gl.getUniformLocation(program, "u_distortion"),
      u_swirl: gl.getUniformLocation(program, "u_swirl"),
      u_swirlIterations: gl.getUniformLocation(program, "u_swirlIterations"),
      u_mousePos: gl.getUniformLocation(program, "u_mousePos"),
      u_flowDrift: gl.getUniformLocation(program, "u_flowDrift"),
    };

    const targetRatio = lowRes ? 0.22 : 0.36;
    let cachedBounds = container.getBoundingClientRect();

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      cachedBounds = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * targetRatio));
      canvas.height = Math.max(1, Math.floor(height * targetRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const handlePointerMove = (e: PointerEvent) => {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const nx = e.clientX / vw;
      const ny = 1.0 - e.clientY / vh;

      const p = pointerFlowRef.current;
      p.rawX = Math.max(0, Math.min(1, nx));
      p.rawY = Math.max(0, Math.min(1, ny));
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    let prevTime = performance.now();

    const animate = (time: number) => {
      frameIdRef.current = requestAnimationFrame(animate);
      if (document.hidden) return;

      const dt = Math.min(0.05, (time - prevTime) / 1000);
      prevTime = time;

      const currentParams = paramsRef.current;
      const elapsed = (time - startTimeRef.current) / 1000;
      const speed = (currentParams.speed / 100) * 1.5;

      // Física líquida responsiva e visível: acompanha o cursor com ondas suaves na água
      const p = pointerFlowRef.current;
      const prevSmoothX = p.smoothX;
      const prevSmoothY = p.smoothY;

      const followRate = 1.0 - Math.exp(-dt * 4.2);
      p.smoothX += (p.rawX - p.smoothX) * followRate;
      p.smoothY += (p.rawY - p.smoothY) * followRate;

      const stepX = p.smoothX - prevSmoothX;
      const stepY = p.smoothY - prevSmoothY;

      // Impulso contínuo na direção do movimento do cursor
      p.velX = p.velX * Math.exp(-dt * 2.2) + stepX * 1.35;
      p.velY = p.velY * Math.exp(-dt * 2.2) + stepY * 1.35;

      p.driftOffsetX += p.velX * dt * 4.5;
      p.driftOffsetY += p.velY * dt * 4.5;

      gl.uniform1f(uniforms.u_time, elapsed * speed + currentParams.offset * 0.01);
      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.u_pixelRatio, targetRatio);
      gl.uniform1f(uniforms.u_scale, currentParams.scale);
      gl.uniform1f(uniforms.u_rotation, (currentParams.rotation * Math.PI) / 180);

      const c1 = hexToRgba(currentParams.color1);
      const c2 = hexToRgba(currentParams.color2);
      const c3 = hexToRgba(currentParams.color3);
      gl.uniform4f(uniforms.u_color1, c1[0], c1[1], c1[2], c1[3]);
      gl.uniform4f(uniforms.u_color2, c2[0], c2[1], c2[2], c2[3]);
      gl.uniform4f(uniforms.u_color3, c3[0], c3[1], c3[2], c3[3]);

      gl.uniform1f(uniforms.u_proportion, currentParams.proportion / 100);
      gl.uniform1f(uniforms.u_softness, currentParams.softness / 100);
      gl.uniform1f(uniforms.u_shape, PatternShapes[currentParams.shape]);
      gl.uniform1f(uniforms.u_shapeScale, currentParams.shapeSize / 100);
      gl.uniform1f(uniforms.u_distortion, currentParams.distortion / 50);
      gl.uniform1f(uniforms.u_swirl, currentParams.swirl / 100);
      gl.uniform1f(
        uniforms.u_swirlIterations,
        currentParams.swirl === 0 ? 0 : Math.min(currentParams.swirlIterations, 5)
      );

      gl.uniform2f(uniforms.u_mousePos, p.smoothX, p.smoothY);
      gl.uniform2f(uniforms.u_flowDrift, p.driftOffsetX, p.driftOffsetY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameIdRef.current !== undefined) {
        cancelAnimationFrame(frameIdRef.current);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(positionBuffer);
    };
  }, [isMounted, lowRes]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        borderRadius: radius,
        overflow: "hidden",
        transform: "translateZ(0)",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
      {noise && noise.opacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAAElBMVEUAAAAAAAAAAAAAAAAAAAAAAADgKxmiAAAABnRSTlMCCgkGBAVJOAVJAAAASklEQVQ4y2NgGAWjYBSMglEwCgY/YGRgZBQUYmJiZGQEkYwMjIyMgoKCjIyMIJKBgRFIMjIyAklGRkYGRkFBYEcwMDIyMjAOUQAA1I4HwVwZAkYAAAAASUVORK5CYII=")`,
            backgroundSize: (noise.scale ?? 1) * 200,
            backgroundRepeat: "repeat",
            opacity: noise.opacity / 2,
            pointerEvents: "none",
          }}
        />
      )}
      {children}
    </div>
  );
}

function hexToRgba(hex: string): [number, number, number, number] {
  let r = 0,
    g = 0,
    b = 0,
    a = 1;

  if (hex.startsWith("rgba(")) {
    const parts = hex.slice(5, -1).split(",");
    r = parseInt(parts[0]) / 255;
    g = parseInt(parts[1]) / 255;
    b = parseInt(parts[2]) / 255;
    a = parseFloat(parts[3]);
  } else if (hex.startsWith("rgb(")) {
    const parts = hex.slice(4, -1).split(",");
    r = parseInt(parts[0]) / 255;
    g = parseInt(parts[1]) / 255;
    b = parseInt(parts[2]) / 255;
  } else if (hex.startsWith("hsla(") || hex.startsWith("hsl(")) {
    const isHsla = hex.startsWith("hsla(");
    const parts = hex.slice(isHsla ? 5 : 4, -1).split(",");
    const h = parseFloat(parts[0]) / 360;
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    a = isHsla ? parseFloat(parts[3]) : 1;
    [r, g, b] = hslToRgb(h, s, l);
  } else if (hex.startsWith("#")) {
    const c = hex.slice(1);
    if (c.length === 3) {
      r = parseInt(c[0] + c[0], 16) / 255;
      g = parseInt(c[1] + c[1], 16) / 255;
      b = parseInt(c[2] + c[2], 16) / 255;
    } else if (c.length >= 6) {
      r = parseInt(c.slice(0, 2), 16) / 255;
      g = parseInt(c.slice(2, 4), 16) / 255;
      b = parseInt(c.slice(4, 6), 16) / 255;
      if (c.length === 8) {
        a = parseInt(c.slice(6, 8), 16) / 255;
      }
    }
  }

  return [r, g, b, a];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform float u_time;
uniform float u_pixelRatio;
uniform vec2 u_resolution;

uniform float u_scale;
uniform float u_rotation;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform vec4 u_color3;
uniform float u_proportion;
uniform float u_softness;
uniform float u_shape;
uniform float u_shapeScale;
uniform float u_distortion;
uniform float u_swirl;
uniform float u_swirlIterations;
uniform vec2 u_mousePos;
uniform vec2 u_flowDrift;

out vec4 fragColor;

#define TWO_PI 6.28318530718
#define PI 3.14159265358979323846

vec2 rotate(vec2 uv, float th) {
  return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);

  float x1 = mix(a, b, u.x);
  float x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
}

float fbm(vec2 st) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 2; i++) {
    value += amplitude * noise(st);
    st = rotate(st, 0.42) * 2.05 + vec2(0.12, 0.34);
    amplitude *= 0.45;
  }
  return value;
}

vec4 blend_colors(vec4 c1, vec4 c2, vec4 c3, float mixer, float edgesWidth, float edge_blur) {
    vec3 color1 = c1.rgb * c1.a;
    vec3 color2 = c2.rgb * c2.a;
    vec3 color3 = c3.rgb * c3.a;

    float r1 = smoothstep(0.0 + 0.35 * edgesWidth, 0.7 - 0.35 * edgesWidth + 0.5 * edge_blur, mixer);
    float r2 = smoothstep(0.3 + 0.35 * edgesWidth, 1.0 - 0.35 * edgesWidth + edge_blur, mixer);

    vec3 blended_color_2 = mix(color1, color2, r1);
    float blended_opacity_2 = mix(c1.a, c2.a, r1);

    vec3 c = mix(blended_color_2, color3, r2);
    float o = mix(blended_opacity_2, c3.a, r2);
    return vec4(c, o);
}

void main() {
    vec2 screenUv = gl_FragCoord.xy / u_resolution.xy;
    vec2 uv = screenUv;

    // Halo líquido em torno do cursor que curva e ilumina as ondas de fundo
    vec2 mouseDiff = screenUv - u_mousePos;
    mouseDiff.x *= u_resolution.x / max(1.0, u_resolution.y);
    float distSq = dot(mouseDiff, mouseDiff);
    float silkMask = exp(-distSq * 2.4);
    float coreGlow = exp(-distSq * 6.5);

    float t = u_time * 0.35;

    float noise_scale = 0.0006 + 0.004 * u_scale;

    uv -= 0.5;
    uv *= (noise_scale * u_resolution);
    uv = rotate(uv, u_rotation * 0.5 * PI);
    uv /= u_pixelRatio;
    uv += 0.5;

    // Deslocamento líquido visível que acompanha o passeio do mouse pelas ondas
    vec2 cursorPull = (u_mousePos - 0.5) * 0.65 + mouseDiff * (-0.55 * silkMask);
    vec2 gentleBreeze = u_flowDrift * (0.65 + 0.85 * silkMask) + cursorPull;

    float driftX = sin(t * 0.23 + uv.y * 1.8 + gentleBreeze.x * 1.6) * 0.45 + cos(t * 0.17 + uv.x * 1.2 + gentleBreeze.y * 1.6) * 0.35;
    float driftY = cos(t * 0.19 + uv.x * 1.5 + gentleBreeze.y * 1.6) * 0.45 + sin(t * 0.13 + uv.y * 1.4 - gentleBreeze.x * 1.6) * 0.35;

    vec2 flowUv = uv + vec2(driftX, driftY) * 0.65 + gentleBreeze * 0.55;

    float n1 = fbm(flowUv * 1.2 + vec2(t * 0.22, -t * 0.18));
    float n2 = fbm(flowUv * 2.1 - vec2(t * 0.15, t * 0.27));

    float angle = n1 * TWO_PI;
    uv.x += (2.5 * u_distortion + 0.3) * n2 * cos(angle + t * 0.1);
    uv.y += (2.5 * u_distortion + 0.3) * n2 * sin(angle - t * 0.12);

    float iterations_number = ceil(clamp(u_swirlIterations, 1.0, 5.0));
    for (float i = 1.0; i <= iterations_number; i++) {
        float fi = i * 1.37;
        uv.x += (clamp(u_swirl, 0.0, 1.8) / i) * cos(t * 0.5 + fi * uv.y + n1);
        uv.y += (clamp(u_swirl, 0.0, 1.8) / i) * sin(t * 0.42 + fi * uv.x - n2);
    }

    float proportion = clamp(u_proportion, 0.0, 1.0);

    float shape = 0.0;
    float mixer = 0.0;
    if (u_shape < 0.5) {
      vec2 checks_shape_uv = uv * (0.4 + 2.8 * u_shapeScale);
      shape = 0.5 + 0.5 * sin(checks_shape_uv.x + t * 0.2) * cos(checks_shape_uv.y - t * 0.15);
      mixer = shape + 0.48 * sign(proportion - 0.5) * pow(abs(proportion - 0.5), 0.5);
    } else if (u_shape < 1.5) {
      vec2 stripes_shape_uv = uv * (0.25 + 2.5 * u_shapeScale);
      float f = fract(stripes_shape_uv.y + t * 0.12);
      shape = smoothstep(0.0, 0.55, f) * smoothstep(1.0, 0.45, f);
      mixer = shape + 0.48 * sign(proportion - 0.5) * pow(abs(proportion - 0.5), 0.5);
    } else {
      float sh = 1.0 - uv.y;
      sh -= 0.5;
      sh /= (noise_scale * u_resolution.y);
      sh += 0.5;
      float shape_scaling = 0.2 * (1.0 - u_shapeScale);
      shape = smoothstep(0.45 - shape_scaling, 0.55 + shape_scaling, sh + 0.3 * (proportion - 0.5));
      mixer = shape;
    }

    vec4 color_mix = blend_colors(u_color1, u_color2, u_color3, mixer + coreGlow * 0.16, 1.0 - clamp(u_softness, 0.0, 1.0), 0.01 + 0.01 * u_scale);
    vec3 finalRgb = mix(color_mix.rgb, u_color3.rgb, coreGlow * 0.18);

    fragColor = vec4(finalRgb, color_mix.a);
}
`;
