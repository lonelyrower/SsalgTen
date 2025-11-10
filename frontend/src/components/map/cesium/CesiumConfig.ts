import { logger } from "@/utils/logger";
import * as Cesium from "cesium";

export type CesiumLayerType = "satellite" | "terrain" | "bluemarble" | "natgeo";

// 获取 Cesium Ion Token
export const getCesiumIonToken = (): string => {
  const w: any = typeof window !== "undefined" ? (window as any) : {};
  return (
    w.APP_CONFIG?.CESIUM_ION_TOKEN ||
    import.meta.env.VITE_CESIUM_ION_TOKEN ||
    ""
  );
};

// 初始化 Cesium Ion
export const initCesiumIon = (): boolean => {
  const cesiumIonToken = getCesiumIonToken();

  if (cesiumIonToken) {
    Cesium.Ion.defaultAccessToken = cesiumIonToken;
    logger.log("✓ Cesium Ion已启用（高质量3D渲染）");
    return true;
  } else {
    // 禁用 Cesium Ion，使用免费地图源
    Cesium.Ion.defaultAccessToken = "";
    try {
      (Cesium.Ion as any).defaultServer = "";
      (Cesium.Ion as any).enabled = false;
    } catch {
      // 忽略错误
    }
    logger.log(
      "ℹ Cesium Ion未配置，使用免费地图源（可在设置中添加API key以获得更好的3D效果）",
    );
    return false;
  }
};

// 配置地球视觉效果
export const configureGlobeVisuals = (scene: Cesium.Scene) => {
  const globe = scene.globe;

  // 使用Cesium默认的光照设置，获得更自然的晨昏线效果
  globe.enableLighting = true;

  // 关键：使用默认的太阳光照
  scene.globe.dynamicAtmosphereLighting = true;
  scene.globe.dynamicAtmosphereLightingFromSun = true;

  // 大气层效果 - 使用接近Cesium默认值
  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.brightnessShift = 0.0;
    scene.skyAtmosphere.saturationShift = 0.0;
  }

  globe.showGroundAtmosphere = true;
  globe.atmosphereBrightnessShift = 0.0;
  globe.atmosphereSaturationShift = 0.0;
  globe.showWaterEffect = true;

  // 优化夜间过渡效果
  globe.nightFadeInDistance = 8000000.0;
  globe.nightFadeOutDistance = 15000000.0;

  scene.globe.maximumScreenSpaceError = 1.5;
  scene.globe.tileCacheSize = 200;
  scene.screenSpaceCameraController.enableCollisionDetection = false;

  // 雾效
  scene.fog.enabled = true;
  scene.fog.density = 0.0001;
  scene.fog.minimumBrightness = 0.05;
};

// 获取图层提供商
export const getImageryProvider = async (
  layerType: CesiumLayerType,
): Promise<Cesium.ImageryProvider> => {
  switch (layerType) {
    case "satellite":
      return Cesium.ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer",
      );

    case "terrain":
      return Cesium.ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer",
      );

    case "bluemarble":
      return Cesium.ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer",
      );

    case "natgeo":
    default:
      return Cesium.ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer",
      );
  }
};

// 创建聚合节点图标
export function createClusterIconCanvas(
  size: number,
  count: number,
  color: Cesium.Color,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // 绘制圆形背景
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = color.toCssColorString();
    ctx.fill();

    // 绘制白色边框
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 绘制数字
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.min(size / 2.5, 24)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(count.toString(), size / 2, size / 2);
  }

  return canvas;
}

// 设置相机初始位置
export const setInitialCameraView = (camera: Cesium.Camera) => {
  camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });
};
