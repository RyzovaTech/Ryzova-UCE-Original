import type { TechnologyDefinition } from './technology-registry';

/** Direct dependency markers, not proof that a library is used in production. */
export const TECHNOLOGY_KNOWLEDGE: readonly TechnologyDefinition[] = [
  {
    "id": "pack-react-native",
    "name": "React Native",
    "kind": "library",
    "dependencies": [
      "react-native"
    ]
  },
  {
    "id": "pack-expo",
    "name": "Expo",
    "kind": "library",
    "dependencies": [
      "expo"
    ]
  },
  {
    "id": "pack-ionic",
    "name": "Ionic",
    "kind": "library",
    "dependencies": [
      "@ionic/react"
    ]
  },
  {
    "id": "pack-capacitor",
    "name": "Capacitor",
    "kind": "library",
    "dependencies": [
      "@capacitor/core"
    ]
  },
  {
    "id": "pack-tauri",
    "name": "Tauri",
    "kind": "library",
    "dependencies": [
      "@tauri-apps/api"
    ]
  },
  {
    "id": "pack-redux",
    "name": "Redux",
    "kind": "library",
    "dependencies": [
      "@reduxjs/toolkit"
    ]
  },
  {
    "id": "pack-zustand",
    "name": "Zustand",
    "kind": "library",
    "dependencies": [
      "zustand"
    ]
  },
  {
    "id": "pack-mobx",
    "name": "MobX",
    "kind": "library",
    "dependencies": [
      "mobx"
    ]
  },
  {
    "id": "pack-xstate",
    "name": "XState",
    "kind": "library",
    "dependencies": [
      "xstate"
    ]
  },
  {
    "id": "pack-rxjs",
    "name": "RxJS",
    "kind": "library",
    "dependencies": [
      "rxjs"
    ]
  },
  {
    "id": "pack-lodash",
    "name": "Lodash",
    "kind": "library",
    "dependencies": [
      "lodash"
    ]
  },
  {
    "id": "pack-ramda",
    "name": "Ramda",
    "kind": "library",
    "dependencies": [
      "ramda"
    ]
  },
  {
    "id": "pack-immer",
    "name": "Immer",
    "kind": "library",
    "dependencies": [
      "immer"
    ]
  },
  {
    "id": "pack-zod",
    "name": "Zod",
    "kind": "library",
    "dependencies": [
      "zod"
    ]
  },
  {
    "id": "pack-yup",
    "name": "Yup",
    "kind": "library",
    "dependencies": [
      "yup"
    ]
  },
  {
    "id": "pack-joi",
    "name": "Joi",
    "kind": "library",
    "dependencies": [
      "joi"
    ]
  },
  {
    "id": "pack-ajv",
    "name": "Ajv",
    "kind": "library",
    "dependencies": [
      "ajv"
    ]
  },
  {
    "id": "pack-valibot",
    "name": "Valibot",
    "kind": "library",
    "dependencies": [
      "valibot"
    ]
  },
  {
    "id": "pack-axios",
    "name": "Axios",
    "kind": "library",
    "dependencies": [
      "axios"
    ]
  },
  {
    "id": "pack-ky",
    "name": "Ky",
    "kind": "library",
    "dependencies": [
      "ky"
    ]
  },
  {
    "id": "pack-got",
    "name": "Got",
    "kind": "library",
    "dependencies": [
      "got"
    ]
  },
  {
    "id": "pack-undici",
    "name": "Undici",
    "kind": "library",
    "dependencies": [
      "undici"
    ]
  },
  {
    "id": "pack-day-js",
    "name": "Day.js",
    "kind": "library",
    "dependencies": [
      "dayjs"
    ]
  },
  {
    "id": "pack-luxon",
    "name": "Luxon",
    "kind": "library",
    "dependencies": [
      "luxon"
    ]
  },
  {
    "id": "pack-date-fns",
    "name": "date-fns",
    "kind": "library",
    "dependencies": [
      "date-fns"
    ]
  },
  {
    "id": "pack-moment",
    "name": "Moment",
    "kind": "library",
    "dependencies": [
      "moment"
    ]
  },
  {
    "id": "pack-three-js",
    "name": "Three.js",
    "kind": "library",
    "dependencies": [
      "three"
    ]
  },
  {
    "id": "pack-pixijs",
    "name": "PixiJS",
    "kind": "library",
    "dependencies": [
      "pixi.js"
    ]
  },
  {
    "id": "pack-phaser",
    "name": "Phaser",
    "kind": "library",
    "dependencies": [
      "phaser"
    ]
  },
  {
    "id": "pack-d3",
    "name": "D3",
    "kind": "library",
    "dependencies": [
      "d3"
    ]
  },
  {
    "id": "pack-chart-js",
    "name": "Chart.js",
    "kind": "library",
    "dependencies": [
      "chart.js"
    ]
  },
  {
    "id": "pack-recharts",
    "name": "Recharts",
    "kind": "library",
    "dependencies": [
      "recharts"
    ]
  },
  {
    "id": "pack-echarts",
    "name": "ECharts",
    "kind": "library",
    "dependencies": [
      "echarts"
    ]
  },
  {
    "id": "pack-leaflet",
    "name": "Leaflet",
    "kind": "library",
    "dependencies": [
      "leaflet"
    ]
  },
  {
    "id": "pack-mapbox-gl",
    "name": "Mapbox GL",
    "kind": "library",
    "dependencies": [
      "mapbox-gl"
    ]
  },
  {
    "id": "pack-monaco",
    "name": "Monaco",
    "kind": "library",
    "dependencies": [
      "monaco-editor"
    ]
  },
  {
    "id": "pack-codemirror",
    "name": "CodeMirror",
    "kind": "library",
    "dependencies": [
      "codemirror"
    ]
  },
  {
    "id": "pack-tiptap",
    "name": "TipTap",
    "kind": "library",
    "dependencies": [
      "@tiptap/core"
    ]
  },
  {
    "id": "pack-slate",
    "name": "Slate",
    "kind": "library",
    "dependencies": [
      "slate"
    ]
  },
  {
    "id": "pack-lexical",
    "name": "Lexical",
    "kind": "library",
    "dependencies": [
      "lexical"
    ]
  },
  {
    "id": "pack-prosemirror",
    "name": "ProseMirror",
    "kind": "library",
    "dependencies": [
      "prosemirror-state"
    ]
  },
  {
    "id": "pack-quill",
    "name": "Quill",
    "kind": "library",
    "dependencies": [
      "quill"
    ]
  },
  {
    "id": "pack-yjs",
    "name": "Yjs",
    "kind": "library",
    "dependencies": [
      "yjs"
    ]
  },
  {
    "id": "pack-automerge",
    "name": "Automerge",
    "kind": "library",
    "dependencies": [
      "@automerge/automerge"
    ]
  },
  {
    "id": "pack-socket-io",
    "name": "Socket.IO",
    "kind": "library",
    "dependencies": [
      "socket.io"
    ]
  },
  {
    "id": "pack-ws",
    "name": "ws",
    "kind": "library",
    "dependencies": [
      "ws"
    ]
  },
  {
    "id": "pack-bullmq",
    "name": "BullMQ",
    "kind": "library",
    "dependencies": [
      "bullmq"
    ]
  },
  {
    "id": "pack-bull",
    "name": "Bull",
    "kind": "library",
    "dependencies": [
      "bull"
    ]
  },
  {
    "id": "pack-bree",
    "name": "Bree",
    "kind": "library",
    "dependencies": [
      "bree"
    ]
  },
  {
    "id": "pack-pino",
    "name": "Pino",
    "kind": "library",
    "dependencies": [
      "pino"
    ]
  },
  {
    "id": "pack-winston",
    "name": "Winston",
    "kind": "library",
    "dependencies": [
      "winston"
    ]
  },
  {
    "id": "pack-sentry",
    "name": "Sentry",
    "kind": "library",
    "dependencies": [
      "@sentry/browser"
    ]
  },
  {
    "id": "pack-opentelemetry",
    "name": "OpenTelemetry",
    "kind": "library",
    "dependencies": [
      "@opentelemetry/api"
    ]
  },
  {
    "id": "pack-tensorflow-js",
    "name": "TensorFlow.js",
    "kind": "library",
    "dependencies": [
      "@tensorflow/tfjs"
    ]
  },
  {
    "id": "pack-transformers-js",
    "name": "Transformers.js",
    "kind": "library",
    "dependencies": [
      "@huggingface/transformers"
    ]
  },
  {
    "id": "pack-onnx-runtime",
    "name": "ONNX Runtime",
    "kind": "library",
    "dependencies": [
      "onnxruntime-web"
    ]
  },
  {
    "id": "pack-langchain",
    "name": "LangChain",
    "kind": "library",
    "dependencies": [
      "langchain"
    ]
  },
  {
    "id": "pack-llamaindex",
    "name": "LlamaIndex",
    "kind": "library",
    "dependencies": [
      "llamaindex"
    ]
  },
  {
    "id": "pack-openai-sdk",
    "name": "OpenAI SDK",
    "kind": "library",
    "dependencies": [
      "openai"
    ]
  },
  {
    "id": "pack-anthropic-sdk",
    "name": "Anthropic SDK",
    "kind": "library",
    "dependencies": [
      "@anthropic-ai/sdk"
    ]
  },
  {
    "id": "pack-vercel-ai-sdk",
    "name": "Vercel AI SDK",
    "kind": "library",
    "dependencies": [
      "ai"
    ]
  },
  {
    "id": "pack-web3",
    "name": "Web3",
    "kind": "library",
    "dependencies": [
      "web3"
    ]
  },
  {
    "id": "pack-ethers",
    "name": "Ethers",
    "kind": "library",
    "dependencies": [
      "ethers"
    ]
  },
  {
    "id": "pack-viem",
    "name": "Viem",
    "kind": "library",
    "dependencies": [
      "viem"
    ]
  },
  {
    "id": "pack-wagmi",
    "name": "Wagmi",
    "kind": "library",
    "dependencies": [
      "wagmi"
    ]
  },
  {
    "id": "pack-solana-web3",
    "name": "Solana Web3",
    "kind": "library",
    "dependencies": [
      "@solana/web3.js"
    ]
  },
  {
    "id": "pack-anchor",
    "name": "Anchor",
    "kind": "library",
    "dependencies": [
      "@coral-xyz/anchor"
    ]
  },
  {
    "id": "pack-react-query",
    "name": "React Query",
    "kind": "library",
    "dependencies": [
      "@tanstack/react-query"
    ]
  },
  {
    "id": "pack-swr",
    "name": "SWR",
    "kind": "library",
    "dependencies": [
      "swr"
    ]
  },
  {
    "id": "pack-react-hook-form",
    "name": "React Hook Form",
    "kind": "library",
    "dependencies": [
      "react-hook-form"
    ]
  },
  {
    "id": "pack-formik",
    "name": "Formik",
    "kind": "library",
    "dependencies": [
      "formik"
    ]
  },
  {
    "id": "pack-framer-motion",
    "name": "Framer Motion",
    "kind": "library",
    "dependencies": [
      "framer-motion"
    ]
  },
  {
    "id": "pack-gsap",
    "name": "GSAP",
    "kind": "library",
    "dependencies": [
      "gsap"
    ]
  },
  {
    "id": "pack-react-router",
    "name": "React Router",
    "kind": "library",
    "dependencies": [
      "react-router-dom"
    ]
  },
  {
    "id": "pack-tanstack-router",
    "name": "TanStack Router",
    "kind": "library",
    "dependencies": [
      "@tanstack/react-router"
    ]
  },
  {
    "id": "pack-storybook",
    "name": "Storybook",
    "kind": "library",
    "dependencies": [
      "storybook"
    ]
  },
  {
    "id": "pack-docusaurus",
    "name": "Docusaurus",
    "kind": "library",
    "dependencies": [
      "@docusaurus/core"
    ]
  },
  {
    "id": "pack-vitepress",
    "name": "VitePress",
    "kind": "library",
    "dependencies": [
      "vitepress"
    ]
  },
  {
    "id": "pack-vuepress",
    "name": "VuePress",
    "kind": "library",
    "dependencies": [
      "vuepress"
    ]
  },
  {
    "id": "pack-nextra",
    "name": "Nextra",
    "kind": "library",
    "dependencies": [
      "nextra"
    ]
  },
  {
    "id": "pack-eleventy",
    "name": "Eleventy",
    "kind": "library",
    "dependencies": [
      "@11ty/eleventy"
    ]
  },
  {
    "id": "pack-strapi",
    "name": "Strapi",
    "kind": "library",
    "dependencies": [
      "@strapi/strapi"
    ]
  },
  {
    "id": "pack-payload",
    "name": "Payload",
    "kind": "library",
    "dependencies": [
      "payload"
    ]
  },
  {
    "id": "pack-keystone",
    "name": "Keystone",
    "kind": "library",
    "dependencies": [
      "@keystone-6/core"
    ]
  },
  {
    "id": "pack-directus",
    "name": "Directus",
    "kind": "library",
    "dependencies": [
      "directus"
    ]
  },
  {
    "id": "pack-sanity",
    "name": "Sanity",
    "kind": "library",
    "dependencies": [
      "sanity"
    ]
  },
  {
    "id": "pack-contentful",
    "name": "Contentful",
    "kind": "library",
    "dependencies": [
      "contentful"
    ]
  },
  {
    "id": "pack-cypress",
    "name": "Cypress",
    "kind": "testing",
    "dependencies": [
      "cypress"
    ]
  },
  {
    "id": "pack-mocha",
    "name": "Mocha",
    "kind": "testing",
    "dependencies": [
      "mocha"
    ]
  },
  {
    "id": "pack-chai",
    "name": "Chai",
    "kind": "testing",
    "dependencies": [
      "chai"
    ]
  },
  {
    "id": "pack-jasmine",
    "name": "Jasmine",
    "kind": "testing",
    "dependencies": [
      "jasmine"
    ]
  },
  {
    "id": "pack-ava",
    "name": "AVA",
    "kind": "testing",
    "dependencies": [
      "ava"
    ]
  },
  {
    "id": "pack-tape",
    "name": "Tape",
    "kind": "testing",
    "dependencies": [
      "tape"
    ]
  },
  {
    "id": "pack-tap",
    "name": "Tap",
    "kind": "testing",
    "dependencies": [
      "tap"
    ]
  },
  {
    "id": "pack-qunit",
    "name": "QUnit",
    "kind": "testing",
    "dependencies": [
      "qunit"
    ]
  },
  {
    "id": "pack-testing-library",
    "name": "Testing Library",
    "kind": "testing",
    "dependencies": [
      "@testing-library/react"
    ]
  },
  {
    "id": "pack-supertest",
    "name": "Supertest",
    "kind": "testing",
    "dependencies": [
      "supertest"
    ]
  },
  {
    "id": "pack-sinon",
    "name": "Sinon",
    "kind": "testing",
    "dependencies": [
      "sinon"
    ]
  },
  {
    "id": "pack-msw",
    "name": "MSW",
    "kind": "testing",
    "dependencies": [
      "msw"
    ]
  },
  {
    "id": "pack-nock",
    "name": "Nock",
    "kind": "testing",
    "dependencies": [
      "nock"
    ]
  },
  {
    "id": "pack-puppeteer",
    "name": "Puppeteer",
    "kind": "testing",
    "dependencies": [
      "puppeteer"
    ]
  },
  {
    "id": "pack-webdriverio",
    "name": "WebdriverIO",
    "kind": "testing",
    "dependencies": [
      "webdriverio"
    ]
  },
  {
    "id": "pack-selenium",
    "name": "Selenium",
    "kind": "testing",
    "dependencies": [
      "selenium-webdriver"
    ]
  },
  {
    "id": "pack-karma",
    "name": "Karma",
    "kind": "testing",
    "dependencies": [
      "karma"
    ]
  },
  {
    "id": "pack-nyc",
    "name": "NYC",
    "kind": "testing",
    "dependencies": [
      "nyc"
    ]
  },
  {
    "id": "pack-istanbul",
    "name": "Istanbul",
    "kind": "testing",
    "dependencies": [
      "istanbul-lib-coverage"
    ]
  },
  {
    "id": "pack-c8",
    "name": "C8",
    "kind": "testing",
    "dependencies": [
      "c8"
    ]
  },
  {
    "id": "pack-fast-check",
    "name": "Fast Check",
    "kind": "testing",
    "dependencies": [
      "fast-check"
    ]
  },
  {
    "id": "pack-stryker",
    "name": "Stryker",
    "kind": "testing",
    "dependencies": [
      "@stryker-mutator/core"
    ]
  },
  {
    "id": "pack-axe",
    "name": "Axe",
    "kind": "testing",
    "dependencies": [
      "axe-core"
    ]
  },
  {
    "id": "pack-lighthouse",
    "name": "Lighthouse",
    "kind": "testing",
    "dependencies": [
      "lighthouse"
    ]
  },
  {
    "id": "pack-postgresql",
    "name": "PostgreSQL",
    "kind": "database",
    "dependencies": [
      "pg"
    ]
  },
  {
    "id": "pack-mysql",
    "name": "MySQL",
    "kind": "database",
    "dependencies": [
      "mysql2"
    ]
  },
  {
    "id": "pack-mariadb",
    "name": "MariaDB",
    "kind": "database",
    "dependencies": [
      "mariadb"
    ]
  },
  {
    "id": "pack-sqlite",
    "name": "SQLite",
    "kind": "database",
    "dependencies": [
      "better-sqlite3"
    ]
  },
  {
    "id": "pack-mongodb",
    "name": "MongoDB",
    "kind": "database",
    "dependencies": [
      "mongodb"
    ]
  },
  {
    "id": "pack-redis",
    "name": "Redis",
    "kind": "database",
    "dependencies": [
      "redis"
    ]
  },
  {
    "id": "pack-ioredis",
    "name": "ioredis",
    "kind": "database",
    "dependencies": [
      "ioredis"
    ]
  },
  {
    "id": "pack-cassandra",
    "name": "Cassandra",
    "kind": "database",
    "dependencies": [
      "cassandra-driver"
    ]
  },
  {
    "id": "pack-dynamodb",
    "name": "DynamoDB",
    "kind": "database",
    "dependencies": [
      "@aws-sdk/client-dynamodb"
    ]
  },
  {
    "id": "pack-elasticsearch",
    "name": "Elasticsearch",
    "kind": "database",
    "dependencies": [
      "@elastic/elasticsearch"
    ]
  },
  {
    "id": "pack-opensearch",
    "name": "OpenSearch",
    "kind": "database",
    "dependencies": [
      "@opensearch-project/opensearch"
    ]
  },
  {
    "id": "pack-firebase",
    "name": "Firebase",
    "kind": "database",
    "dependencies": [
      "firebase"
    ]
  },
  {
    "id": "pack-supabase",
    "name": "Supabase",
    "kind": "database",
    "dependencies": [
      "@supabase/supabase-js"
    ]
  },
  {
    "id": "pack-neo4j",
    "name": "Neo4j",
    "kind": "database",
    "dependencies": [
      "neo4j-driver"
    ]
  },
  {
    "id": "pack-couchdb",
    "name": "CouchDB",
    "kind": "database",
    "dependencies": [
      "nano"
    ]
  },
  {
    "id": "pack-pouchdb",
    "name": "PouchDB",
    "kind": "database",
    "dependencies": [
      "pouchdb"
    ]
  },
  {
    "id": "pack-leveldb",
    "name": "LevelDB",
    "kind": "database",
    "dependencies": [
      "level"
    ]
  },
  {
    "id": "pack-lmdb",
    "name": "LMDB",
    "kind": "database",
    "dependencies": [
      "lmdb"
    ]
  },
  {
    "id": "pack-duckdb",
    "name": "DuckDB",
    "kind": "database",
    "dependencies": [
      "duckdb"
    ]
  },
  {
    "id": "pack-clickhouse",
    "name": "ClickHouse",
    "kind": "database",
    "dependencies": [
      "@clickhouse/client"
    ]
  },
  {
    "id": "pack-influxdb",
    "name": "InfluxDB",
    "kind": "database",
    "dependencies": [
      "@influxdata/influxdb-client"
    ]
  },
  {
    "id": "pack-pinecone",
    "name": "Pinecone",
    "kind": "database",
    "dependencies": [
      "@pinecone-database/pinecone"
    ]
  },
  {
    "id": "pack-qdrant",
    "name": "Qdrant",
    "kind": "database",
    "dependencies": [
      "@qdrant/js-client-rest"
    ]
  },
  {
    "id": "pack-weaviate",
    "name": "Weaviate",
    "kind": "database",
    "dependencies": [
      "weaviate-client"
    ]
  },
  {
    "id": "pack-milvus",
    "name": "Milvus",
    "kind": "database",
    "dependencies": [
      "@zilliz/milvus2-sdk-node"
    ]
  },
  {
    "id": "pack-chroma",
    "name": "Chroma",
    "kind": "database",
    "dependencies": [
      "chromadb"
    ]
  },
  {
    "id": "pack-drizzle",
    "name": "Drizzle",
    "kind": "orm",
    "dependencies": [
      "drizzle-orm"
    ]
  },
  {
    "id": "pack-typeorm",
    "name": "TypeORM",
    "kind": "orm",
    "dependencies": [
      "typeorm"
    ]
  },
  {
    "id": "pack-sequelize",
    "name": "Sequelize",
    "kind": "orm",
    "dependencies": [
      "sequelize"
    ]
  },
  {
    "id": "pack-mongoose",
    "name": "Mongoose",
    "kind": "orm",
    "dependencies": [
      "mongoose"
    ]
  },
  {
    "id": "pack-knex",
    "name": "Knex",
    "kind": "orm",
    "dependencies": [
      "knex"
    ]
  },
  {
    "id": "pack-objection",
    "name": "Objection",
    "kind": "orm",
    "dependencies": [
      "objection"
    ]
  },
  {
    "id": "pack-mikroorm",
    "name": "MikroORM",
    "kind": "orm",
    "dependencies": [
      "@mikro-orm/core"
    ]
  },
  {
    "id": "pack-kysely",
    "name": "Kysely",
    "kind": "orm",
    "dependencies": [
      "kysely"
    ]
  },
  {
    "id": "pack-bookshelf",
    "name": "Bookshelf",
    "kind": "orm",
    "dependencies": [
      "bookshelf"
    ]
  },
  {
    "id": "pack-waterline",
    "name": "Waterline",
    "kind": "orm",
    "dependencies": [
      "waterline"
    ]
  },
  {
    "id": "pack-webpack",
    "name": "Webpack",
    "kind": "build-tool",
    "dependencies": [
      "webpack"
    ]
  },
  {
    "id": "pack-rollup",
    "name": "Rollup",
    "kind": "build-tool",
    "dependencies": [
      "rollup"
    ]
  },
  {
    "id": "pack-esbuild",
    "name": "esbuild",
    "kind": "build-tool",
    "dependencies": [
      "esbuild"
    ]
  },
  {
    "id": "pack-parcel",
    "name": "Parcel",
    "kind": "build-tool",
    "dependencies": [
      "parcel"
    ]
  },
  {
    "id": "pack-rspack",
    "name": "Rspack",
    "kind": "build-tool",
    "dependencies": [
      "@rspack/core"
    ]
  },
  {
    "id": "pack-babel",
    "name": "Babel",
    "kind": "build-tool",
    "dependencies": [
      "@babel/core"
    ]
  },
  {
    "id": "pack-swc",
    "name": "SWC",
    "kind": "build-tool",
    "dependencies": [
      "@swc/core"
    ]
  },
  {
    "id": "pack-gulp",
    "name": "Gulp",
    "kind": "build-tool",
    "dependencies": [
      "gulp"
    ]
  },
  {
    "id": "pack-grunt",
    "name": "Grunt",
    "kind": "build-tool",
    "dependencies": [
      "grunt"
    ]
  },
  {
    "id": "pack-tsup",
    "name": "tsup",
    "kind": "build-tool",
    "dependencies": [
      "tsup"
    ]
  },
  {
    "id": "pack-unbuild",
    "name": "Unbuild",
    "kind": "build-tool",
    "dependencies": [
      "unbuild"
    ]
  },
  {
    "id": "pack-nx",
    "name": "Nx",
    "kind": "build-tool",
    "dependencies": [
      "nx"
    ]
  },
  {
    "id": "pack-turborepo",
    "name": "Turborepo",
    "kind": "build-tool",
    "dependencies": [
      "turbo"
    ]
  },
  {
    "id": "pack-lerna",
    "name": "Lerna",
    "kind": "build-tool",
    "dependencies": [
      "lerna"
    ]
  },
  {
    "id": "pack-rush",
    "name": "Rush",
    "kind": "build-tool",
    "dependencies": [
      "@microsoft/rush"
    ]
  },
  {
    "id": "pack-hardhat",
    "name": "Hardhat",
    "kind": "build-tool",
    "dependencies": [
      "hardhat"
    ]
  },
  {
    "id": "pack-truffle",
    "name": "Truffle",
    "kind": "build-tool",
    "dependencies": [
      "truffle"
    ]
  },
  {
    "id": "pack-passport",
    "name": "Passport",
    "kind": "auth",
    "dependencies": [
      "passport"
    ]
  },
  {
    "id": "pack-nextauth",
    "name": "NextAuth",
    "kind": "auth",
    "dependencies": [
      "next-auth"
    ]
  },
  {
    "id": "pack-auth0",
    "name": "Auth0",
    "kind": "auth",
    "dependencies": [
      "@auth0/auth0-react"
    ]
  },
  {
    "id": "pack-clerk",
    "name": "Clerk",
    "kind": "auth",
    "dependencies": [
      "@clerk/clerk-react"
    ]
  },
  {
    "id": "pack-lucia",
    "name": "Lucia",
    "kind": "auth",
    "dependencies": [
      "lucia"
    ]
  },
  {
    "id": "pack-better-auth",
    "name": "Better Auth",
    "kind": "auth",
    "dependencies": [
      "better-auth"
    ]
  },
  {
    "id": "pack-jose",
    "name": "Jose",
    "kind": "auth",
    "dependencies": [
      "jose"
    ]
  },
  {
    "id": "pack-json-web-token",
    "name": "JSON Web Token",
    "kind": "auth",
    "dependencies": [
      "jsonwebtoken"
    ]
  },
  {
    "id": "pack-argon2",
    "name": "Argon2",
    "kind": "auth",
    "dependencies": [
      "argon2"
    ]
  },
  {
    "id": "pack-bcrypt",
    "name": "bcrypt",
    "kind": "auth",
    "dependencies": [
      "bcrypt"
    ]
  },
  {
    "id": "pack-bootstrap",
    "name": "Bootstrap",
    "kind": "styling",
    "dependencies": [
      "bootstrap"
    ]
  },
  {
    "id": "pack-bulma",
    "name": "Bulma",
    "kind": "styling",
    "dependencies": [
      "bulma"
    ]
  },
  {
    "id": "pack-chakra-ui",
    "name": "Chakra UI",
    "kind": "styling",
    "dependencies": [
      "@chakra-ui/react"
    ]
  },
  {
    "id": "pack-material-ui",
    "name": "Material UI",
    "kind": "styling",
    "dependencies": [
      "@mui/material"
    ]
  },
  {
    "id": "pack-ant-design",
    "name": "Ant Design",
    "kind": "styling",
    "dependencies": [
      "antd"
    ]
  },
  {
    "id": "pack-mantine",
    "name": "Mantine",
    "kind": "styling",
    "dependencies": [
      "@mantine/core"
    ]
  },
  {
    "id": "pack-emotion",
    "name": "Emotion",
    "kind": "styling",
    "dependencies": [
      "@emotion/react"
    ]
  },
  {
    "id": "pack-styled-components",
    "name": "Styled Components",
    "kind": "styling",
    "dependencies": [
      "styled-components"
    ]
  },
  {
    "id": "pack-unocss",
    "name": "UnoCSS",
    "kind": "styling",
    "dependencies": [
      "unocss"
    ]
  },
  {
    "id": "pack-panda-css",
    "name": "Panda CSS",
    "kind": "styling",
    "dependencies": [
      "@pandacss/dev"
    ]
  },
  {
    "id": "pack-eslint",
    "name": "ESLint",
    "kind": "linting",
    "dependencies": [
      "eslint"
    ]
  },
  {
    "id": "pack-prettier",
    "name": "Prettier",
    "kind": "linting",
    "dependencies": [
      "prettier"
    ]
  },
  {
    "id": "pack-biome",
    "name": "Biome",
    "kind": "linting",
    "dependencies": [
      "@biomejs/biome"
    ]
  },
  {
    "id": "pack-stylelint",
    "name": "Stylelint",
    "kind": "linting",
    "dependencies": [
      "stylelint"
    ]
  },
  {
    "id": "pack-oxlint",
    "name": "Oxlint",
    "kind": "linting",
    "dependencies": [
      "oxlint"
    ]
  }
];
