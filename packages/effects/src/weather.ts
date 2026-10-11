import type { Arc3DContext } from "@arc3dlab/core"
import { getCesiumViewer } from "@arc3dlab/engine-cesium"
import { Cartesian4, Color, PostProcessStage } from "cesium"

/** 支持的天气特效类型。 */
export type WeatherKind = "rain" | "snow" | "fog" | "lightning"

/** 雨特效选项。 */
export interface RainOptions {
  /** 雨丝倾斜角度，负值向右、正值向左，单位为弧度。 */
  tiltAngle?: number
  /** 雨的尺度系数。 */
  rainSize?: number
  /** 雨的下降速度，值越大越快。 */
  rainSpeed?: number
}

/** 雪特效选项。 */
export interface SnowOptions {
  /** 雪花的尺度系数，建议小于 0.02。 */
  snowSize?: number
  /** 雪花的下落速度。 */
  snowSpeed?: number
}

/** 雾特效选项。 */
export interface FogOptions {
  /** 雾颜色（CSS 颜色）。 */
  color?: string
  /** 雾起始距离，单位为米。 */
  near?: number
  /** 起始位置的雾透明度。 */
  nearAlpha?: number
  /** 雾结束距离，单位为米。 */
  far?: number
  /** 结束位置的雾透明度。 */
  farAlpha?: number
}

/** 雨特效默认选项。 */
export const RAIN_DEFAULTS: Required<RainOptions> = {
  tiltAngle: -0.6,
  rainSize: 1,
  rainSpeed: 100,
}

/** 雪特效默认选项。 */
export const SNOW_DEFAULTS: Required<SnowOptions> = {
  snowSize: 0.02,
  snowSpeed: 60,
}

/** 雾特效默认选项。 */
export const FOG_DEFAULTS: Required<FogOptions> = {
  color: "#ffffff",
  near: 10,
  nearAlpha: 0,
  far: 1000,
  farAlpha: 0.8,
}

/**
 * 合并雨特效选项与默认值。
 * @param options - 用户选项。
 * @returns 补全后的雨特效选项。
 */
export function resolveRainOptions(
  options: RainOptions = {},
): Required<RainOptions> {
  return { ...RAIN_DEFAULTS, ...options }
}

/**
 * 合并雪特效选项与默认值。
 * @param options - 用户选项。
 * @returns 补全后的雪特效选项。
 */
export function resolveSnowOptions(
  options: SnowOptions = {},
): Required<SnowOptions> {
  return { ...SNOW_DEFAULTS, ...options }
}

/**
 * 合并雾特效选项与默认值。
 * @param options - 用户选项。
 * @returns 补全后的雾特效选项。
 */
export function resolveFogOptions(
  options: FogOptions = {},
): Required<FogOptions> {
  return { ...FOG_DEFAULTS, ...options }
}

const RAIN_SHADER = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
uniform float tiltAngle;
uniform float rainSize;
uniform float rainSpeed;
float hash(float x){ return fract(sin(x*133.3)*13.13); }
out vec4 out_FragColor;
void main(void){
  float time=czm_frameNumber/rainSpeed;
  vec2 resolution=czm_viewport.zw;
  vec2 uv=(gl_FragCoord.xy*2.-resolution.xy)/min(resolution.x,resolution.y);
  vec3 c=vec3(.6,.7,.8);
  float a=tiltAngle;
  float si=sin(a),co=cos(a);
  uv*=mat2(co,-si,si,co);
  uv*=length(uv+vec2(0,4.9))*rainSize+1.;
  float v=1.-sin(hash(floor(uv.x*100.))*2.);
  float b=clamp(abs(sin(20.*time*v+uv.y*(5./(2.+v))))-.95,0.,1.)*20.;
  c*=v*b;
  out_FragColor=mix(texture(colorTexture,v_textureCoordinates),vec4(c,1),.5);
}
`

const SNOW_SHADER = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
uniform float snowSpeed;
uniform float snowSize;
float snow(vec2 uv,float scale){
  float time=czm_frameNumber/snowSpeed;
  float w=smoothstep(1.,0.,-uv.y*(scale/10.));if(w<.1)return 0.;
  uv+=time/scale;uv.y+=time*2./scale;uv.x+=sin(uv.y+time*.5)/scale;
  uv*=scale;vec2 s=floor(uv),f=fract(uv),p;float k=3.,d;
  p=.5+.35*sin(11.*fract(sin((s+p+scale)*mat2(7,3,6,5))*5.))-f;d=length(p);k=min(d,k);
  k=smoothstep(0.,k,sin(f.x+f.y)*snowSize);
  return k*w;
}
out vec4 out_FragColor;
void main(void){
  vec2 resolution=czm_viewport.zw;
  vec2 uv=(gl_FragCoord.xy*2.-resolution.xy)/min(resolution.x,resolution.y);
  vec3 finalColor=vec3(0);
  float c=smoothstep(1.,.3,clamp(uv.y*.3+.8,0.,.75));
  c+=snow(uv,10.);
  c+=snow(uv,8.);
  c+=snow(uv,6.);
  c+=snow(uv,5.);
  finalColor=(vec3(c));
  out_FragColor=mix(texture(colorTexture,v_textureCoordinates),vec4(finalColor,1),.5);
}
`

const FOG_SHADER = `
float getDistance(sampler2D depthTexture,vec2 texCoords){
  float depth=czm_unpackDepth(texture(depthTexture,texCoords));
  if(depth==0.){
    return czm_infinity;
  }
  vec4 eyeCoordinate=czm_windowToEyeCoordinates(gl_FragCoord.xy,depth);
  return-eyeCoordinate.z/eyeCoordinate.w;
}
float interpolateByDistance(vec4 nearFarScalar,float distance){
  float startDistance=nearFarScalar.x;
  float startValue=nearFarScalar.y;
  float endDistance=nearFarScalar.z;
  float endValue=nearFarScalar.w;
  float t=clamp((distance-startDistance)/(endDistance-startDistance),0.,1.);
  return mix(startValue,endValue,t);
}
vec4 alphaBlend(vec4 sourceColor,vec4 destinationColor){
  return sourceColor*vec4(sourceColor.aaa,1.)+destinationColor*(1.-sourceColor.a);
}
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform vec4 fogByDistance;
uniform vec4 fogColor;
in vec2 v_textureCoordinates;
void main(void){
  float distance=getDistance(depthTexture,v_textureCoordinates);
  vec4 sceneColor=texture(colorTexture,v_textureCoordinates);
  float blendAmount=interpolateByDistance(fogByDistance,distance);
  vec4 finalFogColor=vec4(fogColor.rgb,fogColor.a*blendAmount);
  out_FragColor=alphaBlend(finalFogColor,sceneColor);
}
`

const LIGHTNING_SHADER = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;

float rand(float x)
{
  return fract(sin(x)*75154.32912);
}

float rand3d(vec3 x)
{
  return fract(375.10297*sin(dot(x,vec3(103.0139,227.0595,31.05914))));
}
float noise(float x)
{
  float i=floor(x);
  float a=rand(i),b=rand(i+1.);
  float f=x-i;
  return mix(a,b,f);
}

float perlin(float x)
{
  float r=0.,s=1.,w=1.;
  for(int i=0;i<6;i++){
    s*=2.;
    w*=.5;
    r+=w*noise(s*x);
  }
  return r;
}
float noise3d(vec3 x)
{
  vec3 i=floor(x);
  float i000=rand3d(i+vec3(0.,0.,0.)),i001=rand3d(i+vec3(0.,0.,1.));
  float i010=rand3d(i+vec3(0.,1.,0.)),i011=rand3d(i+vec3(0.,1.,1.));
  float i100=rand3d(i+vec3(1.,0.,0.)),i101=rand3d(i+vec3(1.,0.,1.));
  float i110=rand3d(i+vec3(1.,1.,0.)),i111=rand3d(i+vec3(1.,1.,1.));
  vec3 f=x-i;
  return mix(mix(mix(i000,i001,f.z),mix(i010,i011,f.z),f.y),
  mix(mix(i100,i101,f.z),mix(i110,i111,f.z),f.y),f.x);
}

float perlin3d(vec3 x)
{
  float r=0.;
  float w=1.,s=1.;
  for(int i=0;i<5;i++){
    w*=.5;
    s*=2.;
    r+=w*noise3d(s*x);
  }
  return r;
}

float f(float y)
{
  float w=.4;
  return w*(perlin(2.*y)-.5);
}

float plot(vec2 p,float d,bool thicker)
{
  if(thicker)d+=5.*abs(f(p.y+.001)-f(p.y));
  return smoothstep(d,0.,abs(f(p.y)-p.x));
}

float cloud(vec2 uv,float speed,float scale,float cover)
{
  float iTime=czm_frameNumber*.008;
  float c=perlin3d(vec3(uv*scale,iTime*speed*2.));
  return max(0.,c-(1.-cover));
}

vec3 render(vec2 uv)
{
  float iTime=czm_frameNumber*.008;
  float x=iTime+.1;
  float m=.25;
  float i=floor(x/m);
  float f=x/m-i;
  float k=.4;
  float n=noise(i);
  float t=ceil(n-k);
  float d=max(0.,n-k)/(1.-k);
  float o=ceil(t-f-(1.-d));
  float gt=.1;
  float go=ceil(t-f-(1.-gt));

  float lightning=0.;
  float light=0.;
  float glare=0.;

  if(o==1.){
    vec2 uv2=uv;
    uv2.y+=i*2.;
    float p=(noise(i+10.)-.5)*2.;
    uv2.x-=p;

    float strike=plot(uv2,.01,true);
    float glow=plot(uv2,.04,false);
    float glow2=plot(uv2,1.5,false);

    lightning=strike*.4+glow*.15;

    float h=noise(i+5.);
    lightning*=smoothstep(h,h+.05,uv.y+perlin(1.2*uv.x+4.*h)*.03);
    lightning+=glow2*.3;
    light=smoothstep(5.,0.,abs(uv.x-p));
    glare=go*light;
  }

  vec3 clouds=
  vec3(.5,.7,1.)*mix(.6,.9,cloud(uv,.2,.1,1.))+
  vec3(.7,.8,1.)*.6*cloud(uv*vec2(.5,1.),.06,.8,.8)+
  vec3(.9,.9,1.)*.3*cloud(uv*vec2(.1,1.),.08,5.5,.6)+
  vec3(1.,1.,1.)*.4*cloud(uv*vec2(.1,1.),.07,10.,.5);

  vec3 background=vec3(.8);
  background*=(.2+light*.5);

  return vec3(background+lightning+glare);
}

void main()
{
  vec2 iResolution=czm_viewport.zw;
  vec2 uv=(gl_FragCoord.xy*2.-iResolution.xy)/iResolution.y;

  out_FragColor=vec4(render(uv),1.);

  vec4 sceneColor=texture(colorTexture,v_textureCoordinates);
  out_FragColor=mix(out_FragColor,sceneColor,.5);
}
`

const WEATHER_SHADERS: Record<WeatherKind, string> = {
  rain: RAIN_SHADER,
  snow: SNOW_SHADER,
  fog: FOG_SHADER,
  lightning: LIGHTNING_SHADER,
}

/**
 * 天气特效管理器，基于全屏后处理阶段实现雨、雪、雾与闪电。
 *
 * 重复调用 `enable` 不会产生重复阶段，`disable` 后会完整移除阶段。
 */
export class WeatherEffects {
  private readonly stages = new Map<WeatherKind, PostProcessStage>()
  private readonly configs = new Map<WeatherKind, Record<string, unknown>>()

  /**
   * 创建天气特效管理器。
   * @param context - Arc3D 运行上下文。
   */
  constructor(private readonly context: Arc3DContext) {}

  /**
   * 启用指定天气特效。
   * @param kind - 天气类型。
   * @param options - 该天气类型的选项。
   */
  enable(kind: WeatherKind, options: Record<string, unknown> = {}): void {
    this.context.lifecycle.assertUsable(`enable ${kind} weather`)
    this.disable(kind)
    const stage = new PostProcessStage({
      name: `weather_${kind}`,
      fragmentShader: WEATHER_SHADERS[kind],
      uniforms: this.buildUniforms(kind, options),
    })
    getCesiumViewer(
      this.context.engine.native.viewer,
    ).scene.postProcessStages.add(stage)
    this.stages.set(kind, stage)
  }

  /**
   * 停用指定天气特效并移除其阶段。
   * @param kind - 天气类型。
   */
  disable(kind: WeatherKind): void {
    const stage = this.stages.get(kind)
    if (!stage) return
    getCesiumViewer(
      this.context.engine.native.viewer,
    ).scene.postProcessStages.remove(stage)
    this.stages.delete(kind)
  }

  /**
   * 更新指定天气特效的参数；未启用时仅记录配置。
   * @param kind - 天气类型。
   * @param options - 待更新的选项。
   */
  configure(kind: WeatherKind, options: Record<string, unknown> = {}): void {
    this.context.lifecycle.assertUsable(`configure ${kind} weather`)
    const merged = { ...(this.configs.get(kind) ?? {}), ...options }
    this.configs.set(kind, merged)
    const stage = this.stages.get(kind)
    if (!stage) return
    const uniforms = this.buildUniforms(kind, merged)
    for (const [key, value] of Object.entries(uniforms)) {
      stage.uniforms[key] = value as never
    }
  }

  /**
   * 判断指定天气特效是否已启用。
   * @param kind - 天气类型。
   * @returns 已启用时返回 true。
   */
  isEnabled(kind: WeatherKind): boolean {
    return this.stages.has(kind)
  }

  /**
   * 列出当前已启用的天气类型。
   * @returns 已启用的天气类型数组。
   */
  list(): WeatherKind[] {
    return Array.from(this.stages.keys())
  }

  /** 停用并清除全部天气特效。 */
  clear(): void {
    for (const kind of Array.from(this.stages.keys())) this.disable(kind)
    this.configs.clear()
  }

  /** 销毁管理器并释放全部阶段。 */
  destroy(): void {
    this.clear()
  }

  private buildUniforms(
    kind: WeatherKind,
    options: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...(this.configs.get(kind) ?? {}), ...options }
    this.configs.set(kind, merged)
    switch (kind) {
      case "rain": {
        const rain = resolveRainOptions(merged as RainOptions)
        return {
          tiltAngle: () => rain.tiltAngle,
          rainSize: () => rain.rainSize,
          rainSpeed: () => rain.rainSpeed,
        }
      }
      case "snow": {
        const snow = resolveSnowOptions(merged as SnowOptions)
        return {
          snowSize: () => snow.snowSize,
          snowSpeed: () => snow.snowSpeed,
        }
      }
      case "fog": {
        const fog = resolveFogOptions(merged as FogOptions)
        return {
          fogByDistance: () =>
            new Cartesian4(fog.near, fog.nearAlpha, fog.far, fog.farAlpha),
          fogColor: () => Color.fromCssColorString(fog.color),
        }
      }
      default:
        return {}
    }
  }
}
