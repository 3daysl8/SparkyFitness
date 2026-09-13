import waterContainerRepository, {
  type CreateWaterContainerData,
  type UpdateWaterContainerData,
} from '../models/waterContainerRepository.js';
import { log } from '../config/logging.js';
import { WATER_CONTAINER_UNITS } from '../schemas/waterContainerSchemas.js';
import {
  getDrinkPresetCatalogEntry,
  type WaterContainerResponse,
} from '@workspace/shared';

const VALID_UNITS: readonly string[] = WATER_CONTAINER_UNITS;

/**
 * Every throw below is a response to something the caller sent, not a server
 * fault. middleware/errorHandler.ts only honours `statusCode` (it has no
 * message-to-status mapping), so a bare `new Error` here reaches the user as a
 * 500 -- including the "give that food a serving size" guidance in
 * materializeDrinkPreset, which is written to be read and acted on.
 */
type HttpStatusError = Error & { statusCode: number };

function statusError(message: string, statusCode: number): HttpStatusError {
  const error = new Error(message) as HttpStatusError;
  error.statusCode = statusCode;
  return error;
}

// #2115's food-linking feature (a container backed by a food/variant so it could
// carry nutrient data) no longer has a food catalog to link to -- food/nutrition
// tracking was hard-deleted from this fork. linked_food_id/linked_variant_id/
// linked_meal_type_id are now orphaned columns (see the food-goals-cycle-schema
// migration's notes): unlink unconditionally rather than looking anything up, so
// a stale value from before the restructure can still be cleared via update but
// nothing new can ever be attached.
function unlinkFoodFields<
  T extends CreateWaterContainerData | UpdateWaterContainerData,
>(containerData: T): T {
  const resolved = { ...containerData };
  if ('linked_food_id' in resolved) resolved.linked_food_id = null;
  if ('linked_variant_id' in resolved) resolved.linked_variant_id = null;
  if ('linked_meal_type_id' in resolved) resolved.linked_meal_type_id = null;
  return resolved;
}

function convertToMl(volume: number, unit: string): number {
  if (!VALID_UNITS.includes(unit as (typeof VALID_UNITS)[number])) {
    throw statusError('Invalid unit for conversion.', 400);
  }
  switch (unit) {
    case 'oz':
      return volume * 29.5735; // Standard US fluid ounce
    case 'liter':
      return volume * 1000; // 1 liter = 1000 ml
    case 'ml':
    default:
      return volume;
  }
}

async function createWaterContainer(
  userId: string,
  containerData: CreateWaterContainerData
): Promise<WaterContainerResponse> {
  if (
    !VALID_UNITS.includes(containerData.unit as (typeof VALID_UNITS)[number])
  ) {
    throw statusError('Invalid unit provided.', 400);
  }
  try {
    const volumeInMl = convertToMl(containerData.volume, containerData.unit);
    const dataToSave = {
      ...unlinkFoodFields(containerData),
      volume: volumeInMl,
    };
    return await waterContainerRepository.createWaterContainer(
      userId,
      dataToSave
    );
  } catch (error) {
    log('error', `Error creating water container for user ${userId}:`, error);
    throw error;
  }
}

async function getWaterContainersByUserId(
  userId: string
): Promise<WaterContainerResponse[]> {
  try {
    return await waterContainerRepository.getWaterContainersByUserId(userId);
  } catch (error) {
    log('error', `Error fetching water containers for user ${userId}:`, error);
    throw error;
  }
}

async function updateWaterContainer(
  id: number,
  userId: string,
  updateData: UpdateWaterContainerData
): Promise<WaterContainerResponse | null> {
  if (
    updateData.unit &&
    !VALID_UNITS.includes(updateData.unit as (typeof VALID_UNITS)[number])
  ) {
    throw statusError('Invalid unit provided.', 400);
  }
  try {
    const dataToSave = unlinkFoodFields(updateData);
    if (updateData.volume !== undefined && updateData.unit !== undefined) {
      dataToSave.volume = convertToMl(updateData.volume, updateData.unit);
    } else if (
      updateData.volume !== undefined &&
      updateData.unit === undefined
    ) {
      log(
        'warn',
        `Volume updated without unit for container ${id}. Assuming volume is already in ML.`
      );
    }
    return await waterContainerRepository.updateWaterContainer(
      id,
      userId,
      dataToSave
    );
  } catch (error) {
    log(
      'error',
      `Error updating water container ${id} for user ${userId}:`,
      error
    );
    throw error;
  }
}

async function deleteWaterContainer(
  id: number,
  userId: string
): Promise<{ message: string }> {
  try {
    const success = await waterContainerRepository.deleteWaterContainer(
      id,
      userId
    );
    if (!success) {
      throw statusError(
        'Water container not found or not authorized to delete.',
        404
      );
    }
    return { message: 'Water container deleted successfully.' };
  } catch (error) {
    log(
      'error',
      `Error deleting water container ${id} for user ${userId}:`,
      error
    );
    throw error;
  }
}

async function setPrimaryWaterContainer(
  id: number,
  userId: string
): Promise<WaterContainerResponse | null> {
  try {
    return await waterContainerRepository.setPrimaryWaterContainer(id, userId);
  } catch (error) {
    log(
      'error',
      `Error setting primary water container ${id} for user ${userId}:`,
      error
    );
    throw error;
  }
}

async function getPrimaryWaterContainerByUserId(
  userId: string
): Promise<WaterContainerResponse | null> {
  try {
    return await waterContainerRepository.getPrimaryWaterContainerByUserId(
      userId
    );
  } catch (error) {
    log(
      'error',
      `Error fetching primary water container for user ${userId}:`,
      error
    );
    throw error;
  }
}

async function materializeDrinkPreset(
  userId: string,
  catalogId: string
): Promise<WaterContainerResponse> {
  const preset = getDrinkPresetCatalogEntry(catalogId);
  if (!preset) {
    throw statusError(`Drink preset '${catalogId}' not found in catalog.`, 404);
  }

  // Idempotency: check if the user already has a quick-add preset for this drink
  const existingContainers =
    await waterContainerRepository.getWaterContainersByUserId(userId);
  const existing = existingContainers.find(
    (c) =>
      c.is_quick_add &&
      c.name.toLowerCase() === preset.defaultName.toLowerCase()
  );
  if (existing) {
    return existing;
  }

  const maxSortOrder = existingContainers.reduce(
    (max, c) => Math.max(max, c.sort_order ?? 0),
    0
  );

  // Materializes as a plain water container sized from the catalog's volume,
  // carrying only its hydration_factor -- the preset's nutrient fields
  // (calories/caffeine/alcohol/etc.) had nowhere left to live once food/
  // nutrition tracking was hard-deleted from this fork, so a "Latte" or
  // "Beer (Pint)" quick-add now only ever contributes to the water/hydration
  // total, at whatever fraction of its volume hydrationFactor says counts.
  return await waterContainerRepository.createWaterContainer(userId, {
    name: preset.defaultName,
    volume: preset.waterMl ?? preset.volumeMl,
    unit: 'ml',
    is_primary: false,
    servings_per_container: 1,
    hydration_factor: preset.hydrationFactor,
    is_quick_add: true,
    sort_order: maxSortOrder + 1,
  });
}

async function reorderWaterContainers(
  userId: string,
  containerIds: number[]
): Promise<void> {
  await waterContainerRepository.reorderWaterContainers(userId, containerIds);
}

export {
  createWaterContainer,
  getWaterContainersByUserId,
  updateWaterContainer,
  deleteWaterContainer,
  setPrimaryWaterContainer,
  getPrimaryWaterContainerByUserId,
  materializeDrinkPreset,
  reorderWaterContainers,
  convertToMl,
};

export default {
  createWaterContainer,
  getWaterContainersByUserId,
  updateWaterContainer,
  deleteWaterContainer,
  setPrimaryWaterContainer,
  getPrimaryWaterContainerByUserId,
  materializeDrinkPreset,
  reorderWaterContainers,
  convertToMl,
};
