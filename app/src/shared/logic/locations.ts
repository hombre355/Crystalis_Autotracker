/**
 * Aggregated location data (split variant, matching the auto-tracker check refs 1:1).
 * cache_invalidation_location.json is a PopTracker hack and intentionally skipped.
 */
import eastCave from '../../data/locations/east_cave_locations_split.json';
import evilSpiritIsland from '../../data/locations/evil_spirit_island_locations_split.json';
import fogLampCave from '../../data/locations/fog_lamp_cave_locations_split.json';
import goaKarmine from '../../data/locations/goa_karmine_locations_split.json';
import goaKelbesque from '../../data/locations/goa_kelbesque_locations_split.json';
import goaMado from '../../data/locations/goa_mado_locations_split.json';
import goaSabera from '../../data/locations/goa_sabera_locations_split.json';
import kirisaPlantCave from '../../data/locations/kirisa_plant_cave_locations_split.json';
import mtHydra from '../../data/locations/mt_hydra_locations_split.json';
import oasisCave from '../../data/locations/oasis_cave_locations_split.json';
import overworld from '../../data/locations/overworld_locations_split.json';
import pyramidBack from '../../data/locations/pyramid_back_locations_split.json';
import pyramidFront from '../../data/locations/pyramid_front_locations_split.json';
import saberasFortress from '../../data/locations/saberas_fortress_locations_split.json';
import sabreNorth from '../../data/locations/sabre_north_locations_split.json';
import sabreWest from '../../data/locations/sabre_west_locations_split.json';
import sealedCave from '../../data/locations/sealed_cave_locations_split.json';
import styx from '../../data/locations/styx_locations_split.json';
import waterfallCave from '../../data/locations/waterfall_cave_locations_split.json';

export interface PackMapLocation {
  map: string;
  x: number;
  y: number;
  size?: number;
}

export interface PackSection {
  name: string;
  access_rules?: string[];
  visibility_rules?: string[];
  item_count?: number;
}

export interface PackLocation {
  name: string;
  access_rules?: string[];
  force_invisibility_rules?: string[];
  sections?: PackSection[];
  map_locations?: PackMapLocation[];
  children?: PackLocation[];
}

export const ALL_LOCATIONS: readonly PackLocation[] = [
  ...overworld,
  ...eastCave,
  ...sealedCave,
  ...sabreWest,
  ...sabreNorth,
  ...waterfallCave,
  ...fogLampCave,
  ...kirisaPlantCave,
  ...evilSpiritIsland,
  ...mtHydra,
  ...oasisCave,
  ...saberasFortress,
  ...styx,
  ...goaKelbesque,
  ...goaSabera,
  ...goaMado,
  ...goaKarmine,
  ...pyramidFront,
  ...pyramidBack
] as PackLocation[];
