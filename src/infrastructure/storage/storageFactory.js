import { config } from '../../config/env.js';
import { storageService as localStorageService } from '../../infrastructure/storage/localStorageService.js';
import { r2StorageService } from '../../infrastructure/storage/cloudflareR2Service.js';

export const storageService = (config.USE_R2 && config.NODE_ENV !== 'test')
  ? r2StorageService
  : localStorageService;
