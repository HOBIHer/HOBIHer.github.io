import { randomInt, normalizeSeed } from '../../rng';
import type { ActNumber, MapNodeType } from '../../types';

export interface EnemyGroupDefinition {
  id: string;
  name: string;
  lowProfileName: string;
  act: ActNumber;
  nodeType: Exclude<MapNodeType, 'event' | 'rest' | 'shop'>;
  enemyIds: string[];
  weight: number;
}

type EnemyNodeType = EnemyGroupDefinition['nodeType'];

function group(definition: EnemyGroupDefinition): EnemyGroupDefinition {
  return definition;
}

export const enemyGroups: EnemyGroupDefinition[] = [
  group({
    id: 'a1_raider_patrol',
    name: 'Act 1 Raider Patrol',
    lowProfileName: 'Routine file set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['assassin_raider', 'axe_raider', 'crossbow_raider'],
    weight: 4,
  }),
  group({
    id: 'a1_raider_brutes',
    name: 'Act 1 Raider Brutes',
    lowProfileName: 'Routine pressure set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['brute_raider', 'tracker_raider'],
    weight: 4,
  }),
  group({
    id: 'a1_cubex_construct',
    name: 'Cubex Construct',
    lowProfileName: 'Structured item',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['cubex_construct'],
    weight: 2,
  }),
  group({
    id: 'a1_fogmog_eye',
    name: 'Fogmog and Eye',
    lowProfileName: 'Obscured item set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['fogmog', 'eye_with_teeth'],
    weight: 3,
  }),
  group({
    id: 'a1_spore_wurm',
    name: 'Flyconid and Wurm',
    lowProfileName: 'Growth item set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['flyconid', 'fuzzy_wurm_crawler'],
    weight: 3,
  }),
  group({
    id: 'a1_inklet_beetle',
    name: 'Inklet and Shrinker Beetle',
    lowProfileName: 'Small item set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['inklet', 'shrinker_beetle'],
    weight: 3,
  }),
  group({
    id: 'a1_leaf_slimes',
    name: 'Leaf Slimes',
    lowProfileName: 'Residue item set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['leaf_slime_m', 'leaf_slime_s'],
    weight: 3,
  }),
  group({
    id: 'a1_twig_slimes',
    name: 'Twig Slimes',
    lowProfileName: 'Residue branch set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['twig_slime_m', 'twig_slime_s'],
    weight: 3,
  }),
  group({
    id: 'a1_mawler',
    name: 'Mawler',
    lowProfileName: 'Heavy routine item',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['mawler'],
    weight: 2,
  }),
  group({
    id: 'a1_nibbits',
    name: 'Nibbit Pair',
    lowProfileName: 'Mirrored item set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['nibbit', 'nibbit'],
    weight: 3,
  }),
  group({
    id: 'a1_strangler',
    name: 'Slithering Strangler',
    lowProfileName: 'Binding routine item',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['slithering_strangler'],
    weight: 2,
  }),
  group({
    id: 'a1_growth_pair',
    name: 'Jaxfruit and Vine Shambler',
    lowProfileName: 'Escalating item set',
    act: 1,
    nodeType: 'combat',
    enemyIds: ['snapping_jaxfruit', 'vine_shambler'],
    weight: 2,
  }),
  group({
    id: 'a1_bygone_effigy_elite',
    name: 'Bygone Effigy',
    lowProfileName: 'Priority dormant item',
    act: 1,
    nodeType: 'elite',
    enemyIds: ['bygone_effigy'],
    weight: 3,
  }),
  group({
    id: 'a1_byrdonis_elite',
    name: 'Byrdonis',
    lowProfileName: 'Priority scaling item',
    act: 1,
    nodeType: 'elite',
    enemyIds: ['byrdonis'],
    weight: 3,
  }),
  group({
    id: 'a1_phrog_parasite_elite',
    name: 'Phrog Parasite',
    lowProfileName: 'Priority infestation item',
    act: 1,
    nodeType: 'elite',
    enemyIds: ['phrog_parasite', 'wriggler'],
    weight: 2,
  }),
  group({
    id: 'a1_wriggler_elite',
    name: 'Wriggler Pack',
    lowProfileName: 'Priority spawned set',
    act: 1,
    nodeType: 'elite',
    enemyIds: ['wriggler', 'wriggler', 'wriggler'],
    weight: 1,
  }),
  group({
    id: 'a1_vantom_boss',
    name: 'Vantom',
    lowProfileName: 'Act 1 final item',
    act: 1,
    nodeType: 'boss',
    enemyIds: ['vantom'],
    weight: 1,
  }),
  group({
    id: 'a1_ceremonial_beast_boss',
    name: 'Ceremonial Beast',
    lowProfileName: 'Act 1 final heavy item',
    act: 1,
    nodeType: 'boss',
    enemyIds: ['ceremonial_beast'],
    weight: 1,
  }),
  group({
    id: 'a1_kin_boss',
    name: 'The Kin',
    lowProfileName: 'Act 1 final panel',
    act: 1,
    nodeType: 'boss',
    enemyIds: ['kin_priest', 'kin_follower', 'kin_follower'],
    weight: 1,
  }),

  group({
    id: 'a2_bowlbug_pair',
    name: 'Bowlbug Pair',
    lowProfileName: 'Variant item set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['bowlbug_egg', 'bowlbug_silk'],
    weight: 3,
  }),
  group({
    id: 'a2_bowlbug_threats',
    name: 'Bowlbug Threats',
    lowProfileName: 'Variant pressure set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['bowlbug_nectar', 'bowlbug_rock'],
    weight: 3,
  }),
  group({
    id: 'a2_chomper_pair',
    name: 'Chomper Pair',
    lowProfileName: 'Clamp item set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['chomper', 'chomper'],
    weight: 3,
  }),
  group({
    id: 'a2_exoskeleton_hunter',
    name: 'Exoskeleton and Hunter Killer',
    lowProfileName: 'Hunt item set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['exoskeleton', 'hunter_killer'],
    weight: 3,
  }),
  group({
    id: 'a2_louse_progenitor',
    name: 'Louse Progenitor',
    lowProfileName: 'Curl item',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['louse_progenitor'],
    weight: 2,
  }),
  group({
    id: 'a2_myte_pair',
    name: 'Myte Pair',
    lowProfileName: 'Small hazard set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['myte', 'myte'],
    weight: 3,
  }),
  group({
    id: 'a2_ovicopter_eggs',
    name: 'Ovicopter and Tough Eggs',
    lowProfileName: 'Spawn file set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['ovicopter', 'tough_egg', 'tough_egg'],
    weight: 2,
  }),
  group({
    id: 'a2_slumbering_beetle',
    name: 'Slumbering Beetle',
    lowProfileName: 'Dormant item',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['slumbering_beetle'],
    weight: 2,
  }),
  group({
    id: 'a2_spiny_toad',
    name: 'Spiny Toad',
    lowProfileName: 'Spiked item',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['spiny_toad'],
    weight: 2,
  }),
  group({
    id: 'a2_obscura',
    name: 'The Obscura',
    lowProfileName: 'Obscured file',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['the_obscura'],
    weight: 2,
  }),
  group({
    id: 'a2_thief_tunnel',
    name: 'Thief and Tunneler',
    lowProfileName: 'Resource hazard set',
    act: 2,
    nodeType: 'combat',
    enemyIds: ['thieving_hopper', 'tunneler'],
    weight: 2,
  }),
  group({
    id: 'a2_decimillipede_elite',
    name: 'Decimillipede',
    lowProfileName: 'Priority segmented set',
    act: 2,
    nodeType: 'elite',
    enemyIds: ['decimillipede_segment', 'decimillipede_segment', 'decimillipede_segment'],
    weight: 3,
  }),
  group({
    id: 'a2_entomancer_elite',
    name: 'Entomancer',
    lowProfileName: 'Priority hive item',
    act: 2,
    nodeType: 'elite',
    enemyIds: ['entomancer'],
    weight: 3,
  }),
  group({
    id: 'a2_infested_prism_elite',
    name: 'Infested Prism',
    lowProfileName: 'Priority spark item',
    act: 2,
    nodeType: 'elite',
    enemyIds: ['infested_prism'],
    weight: 3,
  }),
  group({
    id: 'a2_knowledge_demon_boss',
    name: 'Knowledge Demon',
    lowProfileName: 'Act 2 final item',
    act: 2,
    nodeType: 'boss',
    enemyIds: ['knowledge_demon'],
    weight: 1,
  }),
  group({
    id: 'a2_insatiable_boss',
    name: 'The Insatiable',
    lowProfileName: 'Act 2 final timer',
    act: 2,
    nodeType: 'boss',
    enemyIds: ['the_insatiable'],
    weight: 1,
  }),
  group({
    id: 'a2_kaiser_crab_boss',
    name: 'Kaiser Crab',
    lowProfileName: 'Act 2 final linked set',
    act: 2,
    nodeType: 'boss',
    enemyIds: ['kaiser_crab_crusher', 'kaiser_crab_rocket'],
    weight: 1,
  }),

  group({
    id: 'a3_axebot_line',
    name: 'Axebot Line',
    lowProfileName: 'Automation item set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['axebot', 'guardbot'],
    weight: 3,
  }),
  group({
    id: 'a3_cultists',
    name: 'Cultists',
    lowProfileName: 'Ritual item set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['calcified_cultist', 'damp_cultist'],
    weight: 3,
  }),
  group({
    id: 'a3_devoted_sculptor',
    name: 'Devoted Sculptor',
    lowProfileName: 'Escalating item',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['devoted_sculptor'],
    weight: 2,
  }),
  group({
    id: 'a3_fabricator_bots',
    name: 'Fabricator and Bots',
    lowProfileName: 'Automation support set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['fabricator', 'stabbot', 'zapbot', 'noisebot'],
    weight: 3,
  }),
  group({
    id: 'a3_frog_globe',
    name: 'Frog Knight and Globe Head',
    lowProfileName: 'Armored item set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['frog_knight', 'globe_head'],
    weight: 3,
  }),
  group({
    id: 'a3_living_shield',
    name: 'Living Shield',
    lowProfileName: 'Guarded item',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['living_shield'],
    weight: 2,
  }),
  group({
    id: 'a3_owl_magistrate',
    name: 'Owl Magistrate',
    lowProfileName: 'Large review item',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['owl_magistrate'],
    weight: 2,
  }),
  group({
    id: 'a3_biting_scrolls',
    name: 'Scrolls of Biting',
    lowProfileName: 'Document hazard set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['scroll_of_biting', 'scroll_of_biting', 'scroll_of_biting'],
    weight: 2,
  }),
  group({
    id: 'a3_slimed_berserker',
    name: 'Slimed Berserker',
    lowProfileName: 'Large residue item',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['slimed_berserker'],
    weight: 2,
  }),
  group({
    id: 'a3_forgotten_lost',
    name: 'Forgotten and Lost',
    lowProfileName: 'Memory item set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['the_forgotten', 'the_lost'],
    weight: 3,
  }),
  group({
    id: 'a3_turret_cubex',
    name: 'Turret Operator and Cubex Construct',
    lowProfileName: 'Ranged item set',
    act: 3,
    nodeType: 'combat',
    enemyIds: ['turret_operator', 'cubex_construct_overgrowth'],
    weight: 3,
  }),
  group({
    id: 'a3_knight_trio_elite',
    name: 'Knight Trio',
    lowProfileName: 'Priority linked trio',
    act: 3,
    nodeType: 'elite',
    enemyIds: ['flail_knight', 'spectral_knight', 'magi_knight'],
    weight: 3,
  }),
  group({
    id: 'a3_mecha_knight_elite',
    name: 'Mecha Knight',
    lowProfileName: 'Priority artifact item',
    act: 3,
    nodeType: 'elite',
    enemyIds: ['mecha_knight'],
    weight: 3,
  }),
  group({
    id: 'a3_soul_nexus_elite',
    name: 'Soul Nexus',
    lowProfileName: 'Priority nexus item',
    act: 3,
    nodeType: 'elite',
    enemyIds: ['soul_nexus'],
    weight: 3,
  }),
  group({
    id: 'a3_doormaker_boss',
    name: 'Doormaker',
    lowProfileName: 'Act 3 final door',
    act: 3,
    nodeType: 'boss',
    enemyIds: ['doormaker_door', 'doormaker'],
    weight: 1,
  }),
  group({
    id: 'a3_queen_boss',
    name: 'The Queen',
    lowProfileName: 'Act 3 final crown',
    act: 3,
    nodeType: 'boss',
    enemyIds: ['torch_head_amalgam', 'the_queen'],
    weight: 1,
  }),
  group({
    id: 'a3_test_subject_c10_boss',
    name: 'Test Subject #C10',
    lowProfileName: 'Act 3 final case',
    act: 3,
    nodeType: 'boss',
    enemyIds: ['test_subject_c10'],
    weight: 1,
  }),
];

export const enemyGroupById: Record<string, EnemyGroupDefinition> = Object.fromEntries(
  enemyGroups.map((group) => [group.id, group]),
);

export function getEnemyGroupsForNodeType(
  nodeType: EnemyNodeType,
  act?: ActNumber,
): EnemyGroupDefinition[] {
  return enemyGroups.filter((group) => group.nodeType === nodeType && (act === undefined || group.act === act));
}

export function selectEnemyGroup(
  nodeType: EnemyNodeType,
  seed: string | number,
  act: ActNumber = 1,
): EnemyGroupDefinition {
  const candidates = getEnemyGroupsForNodeType(nodeType, act);
  if (candidates.length === 0) {
    throw new Error(`No enemy group for node type: ${nodeType} in act ${act}`);
  }

  const totalWeight = candidates.reduce((total, candidate) => total + Math.max(0, candidate.weight), 0);
  if (totalWeight <= 0) {
    return candidates[0];
  }

  const random = randomInt(normalizeSeed(String(seed)), totalWeight);
  let cursor = random.value;

  for (const candidate of candidates) {
    cursor -= Math.max(0, candidate.weight);
    if (cursor < 0) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}
