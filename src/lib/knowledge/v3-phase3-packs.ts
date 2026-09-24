import { TECHNOLOGY_REGISTRY } from '../analyzer/technology-registry';
import type { V3DependencyDetector, V3Rule, V3RulePack } from './v3-types';

/** Evidence-driven deep-ecosystem packs; counts include review signals, not verified defects. */
export const V3_PHASE3_VERSION = '3.2.0';
export const V3_PHASE3_TARGET = 3_500;
export const V3_PHASE3_TOTAL_TARGET = 6_500;
type Ecosystem = V3DependencyDetector['ecosystems'][number];
type Area = 'mobile' | 'desktop' | 'ai-data' | 'games' | 'blockchain' | 'embedded' | 'infrastructure' | 'kubernetes' | 'database' | 'monorepo' | 'serverless' | 'extensions' | 'cms-docs';
interface Signal { area: Area; ecosystem: Ecosystem; name: string; technology: string }

const PACKAGES: Record<Area, Partial<Record<Ecosystem, string>>> = {
  mobile: { npm: 'react-native expo @expo/cli @react-navigation/native @react-navigation/stack react-native-reanimated react-native-gesture-handler react-native-screens react-native-safe-area-context react-native-web react-native-svg react-native-maps react-native-firebase @react-native-firebase/app @react-native-firebase/auth @capacitor/core @capacitor/cli @ionic/react @ionic/angular nativescript cordova cordova-android cordova-ios', dart: 'flutter flutter_localizations flutter_test riverpod flutter_riverpod provider go_router dio http freezed json_serializable firebase_core firebase_auth cloud_firestore sqflite drift shared_preferences hive bloc flutter_bloc', gradle: 'com.android.tools.build:gradle org.jetbrains.kotlin:kotlin-gradle-plugin com.google.gms:google-services com.google.firebase:firebase-bom androidx.core:core-ktx androidx.appcompat:appcompat androidx.compose.ui:ui androidx.compose.material3:material3 androidx.navigation:navigation-compose com.squareup.retrofit2:retrofit com.squareup.okhttp3:okhttp com.google.dagger:hilt-android', swift: 'Alamofire Kingfisher Firebase SwiftLint SnapKit Realm RxSwift CombineCocoa Moya GRDB SDWebImage Apollo iOSSnapshotTestCase' },
  desktop: { npm: 'electron electron-builder electron-updater @electron-forge/cli @electron-forge/maker-squirrel @electron-forge/maker-dmg @tauri-apps/api @tauri-apps/cli @tauri-apps/plugin-fs @tauri-apps/plugin-shell @tauri-apps/plugin-dialog @tauri-apps/plugin-updater nw nodegui @nodegui/nodegui neutralinojs', cargo: 'tauri tauri-build tauri-plugin-fs tauri-plugin-shell tauri-plugin-dialog tauri-plugin-updater wry tao egui eframe iced slint gtk4 gtk-rs', nuget: 'Microsoft.WindowsAppSDK Microsoft.UI.Xaml Avalonia Avalonia.Desktop Avalonia.ReactiveUI CommunityToolkit.Mvvm MahApps.Metro MaterialDesignThemes Wpf.Ui WinForms.DataVisualization' },
  'ai-data': { python: 'torch torchvision torchaudio tensorflow keras jax jaxlib transformers accelerate datasets tokenizers diffusers peft sentence-transformers scikit-learn pandas numpy scipy polars pyarrow dask distributed ray pyspark mlflow wandb fasttext spacy nltk xgboost lightgbm catboost opencv-python onnx onnxruntime openai langchain llama-index chromadb faiss-cpu', npm: '@tensorflow/tfjs @tensorflow/tfjs-node onnxruntime-node onnxruntime-web transformers @xenova/transformers danfojs-node ml-matrix brain.js langchain @langchain/core @langchain/community @huggingface/inference apache-arrow duckdb better-sqlite3' },
  games: { npm: 'phaser pixi.js three @react-three/fiber @react-three/drei babylonjs @babylonjs/core @babylonjs/gui playcanvas matter-js cannon-es rapier @dimforge/rapier3d-compat kaboom melonjs cocos-creator', cargo: 'bevy bevy_ecs bevy_rapier2d bevy_rapier3d macroquad ggez fyrox godot kiss3d wgpu nalgebra', nuget: 'MonoGame.Framework DesktopGL OpenTK Unity.Entities Unity.Collections Stride.Engine GodotSharp' },
  blockchain: { npm: 'ethers viem wagmi @wagmi/core web3 @solana/web3.js @solana/spl-token @coral-xyz/anchor hardhat @nomicfoundation/hardhat-toolbox truffle ganache @openzeppelin/contracts @openzeppelin/hardhat-upgrades graphql-request @polkadot/api bitcoinjs-lib cosmjs starknet', cargo: 'solana-sdk anchor-lang anchor-spl alloy ethers-rs web3 tokio-tungstenite near-sdk ink substrate-frame bitcoin bitcoincore-rpc', python: 'web3 eth-account eth-utils brownie eth-brownie ape pytest-ethereum solana solders bitcoinlib' },
  embedded: { cargo: 'embedded-hal embedded-io embassy-executor embassy-time esp-idf-sys esp-idf-hal rp-pico cortex-m cortex-m-rt stm32f4xx-hal nrf-hal rppal heapless defmt probe-rs', python: 'micropython-rpc adafruit-blinka adafruit-circuitpython-busdevice gpiozero RPi.GPIO pigpio paho-mqtt pyserial esptool platformio', npm: 'johnny-five serialport mqtt node-red node-red-contrib-modbus onoff pigpio i2c-bus' },
  infrastructure: { npm: '@pulumi/pulumi @pulumi/aws @pulumi/azure-native @pulumi/gcp aws-cdk-lib constructs cdktf @cdktf/provider-aws @cdktf/provider-azurerm cdktf-cli @aws-cdk/core @serverless/compose', python: 'pulumi pulumi-aws pulumi-azure-native pulumi-gcp aws-cdk.core aws-cdk-lib cdktf ansible ansible-core boto3 botocore fabric paramiko', go: 'github.com/pulumi/pulumi/sdk/v3 github.com/pulumi/pulumi-aws/sdk/v6 github.com/hashicorp/terraform-plugin-sdk/v2 github.com/hashicorp/terraform-plugin-framework' },
  kubernetes: { npm: '@kubernetes/client-node helm kubernetes-client @pulumi/kubernetes @cdktf/provider-kubernetes', python: 'kubernetes kubernetes-asyncio kopf kr8s pyhelm3', go: 'k8s.io/client-go k8s.io/apimachinery k8s.io/api sigs.k8s.io/controller-runtime helm.sh/helm/v3 sigs.k8s.io/kustomize/api github.com/operator-framework/operator-sdk' },
  database: { npm: 'prisma @prisma/client drizzle-orm drizzle-kit sequelize typeorm knex objection mongoose mongodb pg mysql2 better-sqlite3 sqlite3 redis ioredis @mikro-orm/core @mikro-orm/postgresql kysely @planetscale/database @neondatabase/serverless @supabase/supabase-js @elastic/elasticsearch', python: 'sqlalchemy alembic psycopg psycopg2-binary asyncpg pymysql mysqlclient pymongo motor redis peewee tortoise-orm django-orm django-redis duckdb chromadb clickhouse-driver', cargo: 'sqlx diesel sea-orm rusqlite mongodb redis surrealdb rocksdb sled', go: 'gorm.io/gorm github.com/jmoiron/sqlx github.com/jackc/pgx/v5 go.mongodb.org/mongo-driver github.com/redis/go-redis/v9 entgo.io/ent' },
  monorepo: { npm: 'turbo nx lerna rush @microsoft/rush pnpm-workspace-yaml @nrwl/workspace @nx/js @nx/react @nx/node @nx/next @nx/angular @nx/vite @changesets/cli syncpack lage wireit manypkg', python: 'pantsbuild poetry hatch pdm uv', cargo: 'cargo-make cargo-hakari cargo-nextest cargo-deny cargo-release' },
  serverless: { npm: 'serverless @serverless/framework @aws-sdk/client-lambda aws-cdk-lib @cloudflare/workers-types wrangler @vercel/functions @netlify/functions firebase-functions firebase-admin @azure/functions @google-cloud/functions-framework @pulumi/aws-lambda cloudflare-workers', python: 'chalice zappa mangum aws-lambda-powertools functions-framework firebase-functions azure-functions', go: 'github.com/aws/aws-lambda-go github.com/GoogleCloudPlatform/functions-framework-go' },
  extensions: { npm: 'webextension-polyfill @types/chrome @types/firefox-webext-browser wxt plasmo @plasmohq/storage @plasmohq/messaging crxjs @crxjs/vite-plugin web-ext extensionizer chrome-extension-async browser-extension-template' },
  'cms-docs': { npm: 'next-contentlayer contentlayer @contentlayer/core payload @payloadcms/next @strapi/strapi strapi directus @directus/sdk sanity @sanity/client @sanity/vision contentful @contentful/rich-text-react-renderer @prismicio/client @wordpress/api-fetch @docusaurus/core @docusaurus/preset-classic vitepress vuepress @vuepress/core @astrojs/starlight nextra fumadocs-core fumadocs-ui typedoc @11ty/eleventy', python: 'mkdocs mkdocs-material sphinx myst-parser wagtail django-cms pelican' },
};

const AREA_MATCH: Record<Area, RegExp> = {
  mobile: /android|(?:^|\W)ios(?:\W|$)|flutter|react-native|expo|ionic|capacitor|cordova|swift|dart|mobile|xamarin|jetpack.compose/i,
  desktop: /electron|tauri|qt|desktop|wpf|winui|avalonia|gtk|slint/i,
  'ai-data': /ai-|ml-|python-(?:torch|tensor|transform|numpy|pandas|sci|data|jupyter|polars|ray|dask)|openai|langchain|llama|tensorflow|keras|pytorch/i,
  games: /game|unity|godot|unreal|phaser|pixi|babylon|threejs|bevy|monogame/i,
  blockchain: /blockchain|ethereum|solana|web3|crypto|bitcoin|hardhat|truffle|substrate/i,
  embedded: /embedded|iot|arduino|esp32|raspberry|micropython|zephyr|platformio/i,
  infrastructure: /terraform|pulumi|ansible|cloudformation|cdk|infrastructure|packer/i,
  kubernetes: /kubernetes|k8s|helm|kustomize|operator/i,
  database: /database|orm|redis|postgres|mysql|mongo|prisma|drizzle|sequelize|sqlite|db2-|storage/i,
  monorepo: /monorepo|turborepo|nx-|lerna|rush|pants|bazel|workspace/i,
  serverless: /serverless|lambda|cloudflare-worker|firebase-function|vercel-function|netlify-function/i,
  extensions: /browser-extension|chrome-extension|webextension|plasmo|wxt/i,
  'cms-docs': /cms|docs|documentation|docusaurus|vitepress|mkdocs|sphinx|strapi|sanity|contentful|wordpress|payload/i,
};
const AREA_TECHNOLOGIES: Record<Area, string[]> = {
  mobile: ['flutter', 'dart', 'react-native', 'android', 'ios'],
  desktop: ['electron', 'tauri', 'qt', 'dotnet'],
  'ai-data': ['python', 'tensorflow', 'pytorch'], games: ['unity', 'godot', 'bevy'],
  blockchain: ['web3', 'solana', 'ethereum'], embedded: ['arduino', 'esp32', 'rust'],
  infrastructure: ['terraform', 'pulumi', 'ansible'], kubernetes: ['kubernetes', 'helm'],
  database: ['postgresql', 'mysql', 'mongodb', 'prisma', 'sqlite'], monorepo: ['nx', 'turborepo', 'pnpm'],
  serverless: ['serverless', 'aws-lambda', 'vercel'], extensions: ['browser-extension', 'chrome-extension', 'wxt', 'plasmo'],
  'cms-docs': ['strapi', 'docusaurus', 'vitepress', 'mkdocs'],
};

const POLICIES = [
  { id: 'floating', pattern: '^(?:latest|next|nightly|canary|main|master|head|trunk)$', title: 'Floating version', severity: 'warning' },
  { id: 'prerelease', pattern: '(?:^|[-.])(?:alpha|beta|rc|preview)(?:[.\\d-]|$)', title: 'Pre-release compatibility', severity: 'info' },
  { id: 'snapshot', pattern: '(?:snapshot|nightly|canary|dev)(?:[.\\d-]|$)', title: 'Development snapshot compatibility', severity: 'info' },
  { id: 'git-reference', pattern: '^(?:git\\+|git:|github:|https?://.*\\.git)', title: 'Git source upgrade review', severity: 'warning' },
  { id: 'floating-branch', pattern: '^(?:git\\+|github:|https?://.*\\.git)(?!.*#[a-f0-9]{12,})(?:[^#]*|.*#(?:main|master|dev))$', title: 'Unpinned Git revision', severity: 'warning' },
  { id: 'local-link', pattern: '^(?:file:|link:|path:)', title: 'Local package portability', severity: 'info' },
  { id: 'unbounded', pattern: '^(?:\\*|x|X|>=?\\s*0(?:\\.0)*)$', title: 'Unbounded compatibility range', severity: 'warning' },
  { id: 'zero-major', pattern: '^[~^]?[v=]?0\\.', title: 'Zero-major migration review', severity: 'info' },
  { id: 'wildcard-minor', pattern: '^(?:[v=]?\\d+\\.(?:x|X|\\*)|[v=]?\\d+\\.\\d+\\.(?:x|X|\\*))$', title: 'Wildcard minor/patch compatibility', severity: 'info' },
  { id: 'version-placeholder', pattern: '^(?:\\$\\{|\\$\\(|\\{\\{|<version>|VERSION|TODO)', title: 'Unresolved version placeholder', severity: 'warning' },
] as const;

const MIGRATIONS: Array<{ area: Area; id: string; technologies: string[]; files: string[]; pattern: string; recommendation: string; reference: string }> = [
  { area: 'mobile', id: 'flutter-raised-button', technologies: ['flutter'], files: ['**/*.dart', '*.dart'], pattern: '\\bRaisedButton\\s*\\(', recommendation: 'Review the Flutter button migration guide and use ElevatedButton where appropriate.', reference: 'https://docs.flutter.dev/release/breaking-changes/buttons' },
  { area: 'mobile', id: 'flutter-flat-button', technologies: ['flutter'], files: ['**/*.dart', '*.dart'], pattern: '\\bFlatButton\\s*\\(', recommendation: 'Review the Flutter button migration guide and use TextButton where appropriate.', reference: 'https://docs.flutter.dev/release/breaking-changes/buttons' },
  { area: 'desktop', id: 'electron-remote', technologies: ['electron'], files: ['**/*.js', '**/*.ts', '**/*.mjs', '**/*.cjs'], pattern: '(?:require\\s*\\(\\s*["\x27]electron["\x27]\\s*\\)\\s*\\.\\s*remote|from\\s*["\x27]electron["\x27][^\\n]*\\bremote\\b)', recommendation: 'Review Electron remote-module removal and migrate the IPC boundary.', reference: 'https://www.electronjs.org/docs/latest/breaking-changes' },
  { area: 'desktop', id: 'tauri-v1-allowlist', technologies: ['tauri'], files: ['**/tauri.conf.json', 'tauri.conf.json'], pattern: '"allowlist"\\s*:', recommendation: 'Review Tauri v2 capability permissions and migration from the v1 allowlist.', reference: 'https://v2.tauri.app/start/migrate/from-tauri-1/' },
  { area: 'serverless', id: 'lambda-node12', technologies: ['serverless', 'aws-lambda'], files: ['**/*.yml', '**/*.yaml', '*.yml', '*.yaml'], pattern: '\\bruntime\\s*:\\s*nodejs12\\.x\\b', recommendation: 'Review the AWS Lambda runtime lifecycle and select a supported Node.js runtime.', reference: 'https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html' },
  { area: 'extensions', id: 'manifest-v2', technologies: ['browser-extension', 'chrome-extension', 'wxt', 'plasmo'], files: ['manifest.json', '**/manifest.json'], pattern: '"manifest_version"\\s*:\\s*2\\b', recommendation: 'Review the Chrome extension Manifest V3 migration checklist and required background/service-worker changes.', reference: 'https://developer.chrome.com/docs/extensions/develop/migrate' },
  { area: 'kubernetes', id: 'deployment-v1beta1', technologies: ['kubernetes', 'k8s', 'helm'], files: ['**/*.yaml', '**/*.yml', '*.yaml', '*.yml'], pattern: 'apiVersion:\\s*apps/v1beta[12]\\b', recommendation: 'Migrate the Deployment resource to apps/v1 and review selector requirements.', reference: 'https://kubernetes.io/docs/reference/using-api/deprecation-guide/' },
  { area: 'kubernetes', id: 'ingress-v1beta1', technologies: ['kubernetes', 'k8s', 'helm'], files: ['**/*.yaml', '**/*.yml', '*.yaml', '*.yml'], pattern: 'apiVersion:\\s*(?:extensions|networking.k8s.io)/v1beta1\\b', recommendation: 'Review the resource kind and migrate legacy Ingress resources to networking.k8s.io/v1.', reference: 'https://kubernetes.io/docs/reference/using-api/deprecation-guide/' },
  { area: 'infrastructure', id: 'terraform-interpolation-only', technologies: ['terraform'], files: ['**/*.tf', '*.tf'], pattern: '"\\$\\{\\s*[a-zA-Z_][^}"\\n]+\\s*\\}"', recommendation: 'Review interpolation-only expressions in Terraform configuration and test the modern syntax.', reference: 'https://developer.hashicorp.com/terraform/language/expressions/strings' },
];

function collectSignals(): Signal[] {
  const signals = new Map<string, Signal>();
  for (const [area, ecosystems] of Object.entries(PACKAGES) as Array<[Area, Partial<Record<Ecosystem, string>>]>)
    for (const [ecosystem, names] of Object.entries(ecosystems) as Array<[Ecosystem, string]>)
      for (const name of names.split(/\s+/).filter(Boolean)) signals.set(`${area}:${ecosystem}:${name.toLowerCase()}`, { area, ecosystem, name, technology: name.toLowerCase() });
  for (const definition of TECHNOLOGY_REGISTRY) {
    const area = (Object.keys(AREA_MATCH) as Area[]).find((item) => AREA_MATCH[item].test(`${definition.id} ${definition.name}`));
    if (!area) continue;
    for (const name of definition.dependencies ?? []) signals.set(`${area}:npm:${name.toLowerCase()}`, { area, ecosystem: 'npm', name, technology: definition.id });
    for (const item of definition.ecosystemDependencies ?? []) {
      const ecosystem = item.ecosystem as Ecosystem;
      signals.set(`${area}:${ecosystem}:${item.name.toLowerCase()}`, { area, ecosystem, name: item.name, technology: definition.id });
    }
  }
  const priority = ['react-native', 'riverpod', 'flutter', 'tauri', 'electron', 'wxt', 'torch', 'kubernetes', 'prisma'];
  const rank = (name: string) => { const index = priority.indexOf(name); return index < 0 ? priority.length : index; };
  return [...signals.values()].sort((a, b) => a.area.localeCompare(b.area) || rank(a.name) - rank(b.name) || a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name));
}

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function hash(value: string): string { let n = 2166136261; for (const c of value) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
function makeRule(signal: Signal, policy: typeof POLICIES[number]): V3Rule {
  return {
    id: `compatibility.${signal.area}.${signal.ecosystem}.${slug(signal.name)}-${hash(signal.name)}.${policy.id}`,
    version: V3_PHASE3_VERSION, module: 'dependency', title: `${policy.title}: ${signal.name}`,
    description: `Review ${signal.name} (${signal.ecosystem}) declaration when its version matches ${policy.title.toLowerCase()}. This is a compatibility signal, not proof of an incompatible release.`,
    technologies: [...new Set([signal.technology, signal.name.toLowerCase(), ...AREA_TECHNOLOGIES[signal.area]])], scope: ['configuration', 'production'],
    severity: policy.severity, confidence: 'review-required',
    detectors: [{ kind: 'dependency', ecosystems: [signal.ecosystem], names: [signal.name], version: policy.pattern }],
    evidenceRequirements: { minimum: 1 }, recommendation: `Check ${signal.name} release/migration notes and test a supported, reproducible version for this project.`,
    references: [], falsePositiveNotes: ['Versions can be resolved through lockfiles, catalogs, parent manifests or private registries; confirm the effective version before changing code.'],
    budget: { maxFiles: 10_000, maxMatches: 20, maxContentBytes: 8 * 1024 * 1024, maxMilliseconds: 80 },
    tags: ['phase3', signal.area, 'version-review', policy.id],
  };
}

function build(): V3RulePack[] {
  const groups = new Map<Area, V3Rule[]>();
  const signals = collectSignals();
  const candidates = POLICIES.flatMap((policy) => signals.map((signal) => ({ area: signal.area, rule: makeRule(signal, policy) })));
  const required = V3_PHASE3_TARGET - MIGRATIONS.length;
  if (candidates.length < required) throw new Error(`Only ${candidates.length} Phase 3 version candidates; need ${required}.`);
  // Round-robin preserves broad ecosystem coverage if the registry grows.
  const byArea = new Map<Area, V3Rule[]>();
  for (const candidate of candidates) byArea.set(candidate.area, [...(byArea.get(candidate.area) ?? []), candidate.rule]);
  const areas = Object.keys(PACKAGES) as Area[];
  let selected = 0;
  while (selected < required) for (const area of areas) {
    if (selected >= required) break;
    const rule = byArea.get(area)?.shift();
    if (rule) { groups.set(area, [...(groups.get(area) ?? []), rule]); selected++; }
  }
  for (const migration of MIGRATIONS) {
    const rule: V3Rule = {
      id: `compatibility.${migration.area}.migration.${migration.id}`, version: V3_PHASE3_VERSION,
      module: 'platform', title: `Migration review: ${migration.id}`, description: 'A legacy configuration signature may require a migration for supported platform versions.',
      technologies: migration.technologies, scope: ['configuration', 'production'], severity: 'warning', confidence: 'review-required',
      detectors: [{ kind: 'regex', include: migration.files, pattern: migration.pattern }], evidenceRequirements: { minimum: 1 },
      recommendation: migration.recommendation, references: [migration.reference],
      falsePositiveNotes: ['Check the actual resource and target platform; a matching snippet can be an example or an unrelated resource.'],
      budget: { maxFiles: 10_000, maxMatches: 20, maxContentBytes: 8 * 1024 * 1024, maxMilliseconds: 80 }, tags: ['phase3', migration.area, 'migration'],
    };
    groups.set(migration.area, [...(groups.get(migration.area) ?? []), rule]);
  }
  return areas.map((area): V3RulePack => {
    const rules = groups.get(area) ?? [];
    return { schemaVersion: 3, id: `com.ryzova.uce.v3-phase3.${area}`, name: `UCE V3 Phase 3 — ${area}`, version: V3_PHASE3_VERSION,
      publisher: 'RyzovaTech', description: `Deep ecosystem version review and migration signals for ${area}.`, uceCompatibility: '>=2.0.0 <4.0.0',
      technologies: [...new Set(rules.flatMap((rule) => rule.technologies))], modules: [...new Set(rules.map((rule) => rule.module))], rules };
  });
}

export const V3_PHASE3_RULE_PACKS = build();
export const V3_PHASE3_RULE_COUNT = V3_PHASE3_RULE_PACKS.reduce((sum, pack) => sum + pack.rules.length, 0);
