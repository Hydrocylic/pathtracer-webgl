
export interface ProductProfile {

  sceneWhitelist: string[] | null;

  defaultScene: string;

  lazyScenes: string[];

  prefetchOnIdle: string | null;

  allowGltf: boolean;

  defaultLocale: 'zh' | 'en';
}

export const localProfile: ProductProfile = {
  sceneWhitelist: null,
  defaultScene: 'cornell',
  lazyScenes: ['sponza'],
  prefetchOnIdle: null,
  allowGltf: true,
  defaultLocale: 'zh',
};

export const publicProfile: ProductProfile = {
  sceneWhitelist: ['cornell', 'sponza'],
  defaultScene: 'cornell',
  lazyScenes: ['sponza'],
  prefetchOnIdle: 'sponza',
  allowGltf: false,
  defaultLocale: 'en',
};

export const productProfile: ProductProfile = publicProfile;
