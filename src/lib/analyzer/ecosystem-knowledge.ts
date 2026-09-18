import type { TechnologyDefinition } from './technology-registry';

/** Ecosystem-qualified names avoid npm/PyPI/crates.io package-name collisions. */
export const ECOSYSTEM_KNOWLEDGE: readonly TechnologyDefinition[] = [
  {
    "id": "python-pytorch",
    "name": "PyTorch",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "torch"
      }
    ]
  },
  {
    "id": "python-tensorflow",
    "name": "TensorFlow",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "tensorflow"
      }
    ]
  },
  {
    "id": "python-transformers",
    "name": "Transformers",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "transformers"
      }
    ]
  },
  {
    "id": "python-numpy",
    "name": "NumPy",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "numpy"
      }
    ]
  },
  {
    "id": "python-pandas",
    "name": "Pandas",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "pandas"
      }
    ]
  },
  {
    "id": "python-scipy",
    "name": "SciPy",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "scipy"
      }
    ]
  },
  {
    "id": "python-scikit-learn",
    "name": "Scikit-learn",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "scikit-learn"
      }
    ]
  },
  {
    "id": "python-matplotlib",
    "name": "Matplotlib",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "matplotlib"
      }
    ]
  },
  {
    "id": "python-seaborn",
    "name": "Seaborn",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "seaborn"
      }
    ]
  },
  {
    "id": "python-polars",
    "name": "Polars",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "polars"
      }
    ]
  },
  {
    "id": "python-pyarrow",
    "name": "PyArrow",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "pyarrow"
      }
    ]
  },
  {
    "id": "python-dask",
    "name": "Dask",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "dask"
      }
    ]
  },
  {
    "id": "python-ray",
    "name": "Ray",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "ray"
      }
    ]
  },
  {
    "id": "python-streamlit",
    "name": "Streamlit",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "streamlit"
      }
    ]
  },
  {
    "id": "python-gradio",
    "name": "Gradio",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "gradio"
      }
    ]
  },
  {
    "id": "python-celery",
    "name": "Celery",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "celery"
      }
    ]
  },
  {
    "id": "python-sqlalchemy",
    "name": "SQLAlchemy",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "sqlalchemy"
      }
    ]
  },
  {
    "id": "python-alembic",
    "name": "Alembic",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "alembic"
      }
    ]
  },
  {
    "id": "python-pydantic",
    "name": "Pydantic",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "pydantic"
      }
    ]
  },
  {
    "id": "python-requests",
    "name": "Requests",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "requests"
      }
    ]
  },
  {
    "id": "python-httpx",
    "name": "HTTPX",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "httpx"
      }
    ]
  },
  {
    "id": "python-aiohttp",
    "name": "aiohttp",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "aiohttp"
      }
    ]
  },
  {
    "id": "python-uvicorn",
    "name": "Uvicorn",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "uvicorn"
      }
    ]
  },
  {
    "id": "python-gunicorn",
    "name": "Gunicorn",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "gunicorn"
      }
    ]
  },
  {
    "id": "python-starlette",
    "name": "Starlette",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "starlette"
      }
    ]
  },
  {
    "id": "python-sanic",
    "name": "Sanic",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "sanic"
      }
    ]
  },
  {
    "id": "python-tornado",
    "name": "Tornado",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "tornado"
      }
    ]
  },
  {
    "id": "python-scrapy",
    "name": "Scrapy",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "scrapy"
      }
    ]
  },
  {
    "id": "python-beautiful-soup",
    "name": "Beautiful Soup",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "beautifulsoup4"
      }
    ]
  },
  {
    "id": "python-pytest",
    "name": "Pytest",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "pytest"
      }
    ]
  },
  {
    "id": "python-hypothesis",
    "name": "Hypothesis",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "hypothesis"
      }
    ]
  },
  {
    "id": "python-ruff",
    "name": "Ruff",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "ruff"
      }
    ]
  },
  {
    "id": "python-black",
    "name": "Black",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "black"
      }
    ]
  },
  {
    "id": "python-mypy",
    "name": "Mypy",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "mypy"
      }
    ]
  },
  {
    "id": "python-flake8",
    "name": "Flake8",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "flake8"
      }
    ]
  },
  {
    "id": "python-pylint",
    "name": "Pylint",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "pylint"
      }
    ]
  },
  {
    "id": "python-bandit",
    "name": "Bandit",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "bandit"
      }
    ]
  },
  {
    "id": "python-sphinx",
    "name": "Sphinx",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "sphinx"
      }
    ]
  },
  {
    "id": "python-mkdocs",
    "name": "MkDocs",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "mkdocs"
      }
    ]
  },
  {
    "id": "python-pillow",
    "name": "Pillow",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "pillow"
      }
    ]
  },
  {
    "id": "python-opencv",
    "name": "OpenCV",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "opencv-python"
      }
    ]
  },
  {
    "id": "python-fastapi",
    "name": "FastAPI",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "fastapi"
      }
    ]
  },
  {
    "id": "python-django",
    "name": "Django",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "django"
      }
    ]
  },
  {
    "id": "python-flask",
    "name": "Flask",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "python",
        "name": "flask"
      }
    ]
  },
  {
    "id": "cargo-tokio",
    "name": "Tokio",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "tokio"
      }
    ]
  },
  {
    "id": "cargo-serde",
    "name": "Serde",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "serde"
      }
    ]
  },
  {
    "id": "cargo-reqwest",
    "name": "Reqwest",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "reqwest"
      }
    ]
  },
  {
    "id": "cargo-clap",
    "name": "Clap",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "clap"
      }
    ]
  },
  {
    "id": "cargo-sqlx",
    "name": "SQLx",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "sqlx"
      }
    ]
  },
  {
    "id": "cargo-diesel",
    "name": "Diesel",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "diesel"
      }
    ]
  },
  {
    "id": "cargo-seaorm",
    "name": "SeaORM",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "sea-orm"
      }
    ]
  },
  {
    "id": "cargo-bevy",
    "name": "Bevy",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "bevy"
      }
    ]
  },
  {
    "id": "cargo-tauri",
    "name": "Tauri",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "tauri"
      }
    ]
  },
  {
    "id": "cargo-iced",
    "name": "Iced",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "iced"
      }
    ]
  },
  {
    "id": "cargo-egui",
    "name": "egui",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "egui"
      }
    ]
  },
  {
    "id": "cargo-tracing",
    "name": "Tracing",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "tracing"
      }
    ]
  },
  {
    "id": "cargo-rayon",
    "name": "Rayon",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "rayon"
      }
    ]
  },
  {
    "id": "cargo-criterion",
    "name": "Criterion",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "criterion"
      }
    ]
  },
  {
    "id": "cargo-proptest",
    "name": "Proptest",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "proptest"
      }
    ]
  },
  {
    "id": "cargo-axum",
    "name": "Axum",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "axum"
      }
    ]
  },
  {
    "id": "cargo-actix-web",
    "name": "Actix Web",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "actix-web"
      }
    ]
  },
  {
    "id": "cargo-rocket",
    "name": "Rocket",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "cargo",
        "name": "rocket"
      }
    ]
  },
  {
    "id": "go-cobra",
    "name": "Cobra",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/spf13/cobra"
      }
    ]
  },
  {
    "id": "go-viper",
    "name": "Viper",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/spf13/viper"
      }
    ]
  },
  {
    "id": "go-gorm",
    "name": "GORM",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "gorm.io/gorm"
      }
    ]
  },
  {
    "id": "go-ent",
    "name": "Ent",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "entgo.io/ent"
      }
    ]
  },
  {
    "id": "go-zap",
    "name": "Zap",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "go.uber.org/zap"
      }
    ]
  },
  {
    "id": "go-zerolog",
    "name": "Zerolog",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/rs/zerolog"
      }
    ]
  },
  {
    "id": "go-testify",
    "name": "Testify",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/stretchr/testify"
      }
    ]
  },
  {
    "id": "go-grpc",
    "name": "gRPC",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "google.golang.org/grpc"
      }
    ]
  },
  {
    "id": "go-gin",
    "name": "Gin",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/gin-gonic/gin"
      }
    ]
  },
  {
    "id": "go-fiber",
    "name": "Fiber",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/gofiber/fiber/v2"
      }
    ]
  },
  {
    "id": "go-echo",
    "name": "Echo",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/labstack/echo/v4"
      }
    ]
  },
  {
    "id": "go-chi",
    "name": "Chi",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "go",
        "name": "github.com/go-chi/chi/v5"
      }
    ]
  },
  {
    "id": "composer-phpunit",
    "name": "PHPUnit",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "phpunit/phpunit"
      }
    ]
  },
  {
    "id": "composer-pest",
    "name": "Pest",
    "kind": "testing",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "pestphp/pest"
      }
    ]
  },
  {
    "id": "composer-phpstan",
    "name": "PHPStan",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "phpstan/phpstan"
      }
    ]
  },
  {
    "id": "composer-psalm",
    "name": "Psalm",
    "kind": "linting",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "vimeo/psalm"
      }
    ]
  },
  {
    "id": "composer-monolog",
    "name": "Monolog",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "monolog/monolog"
      }
    ]
  },
  {
    "id": "composer-guzzle",
    "name": "Guzzle",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "guzzlehttp/guzzle"
      }
    ]
  },
  {
    "id": "composer-doctrine-orm",
    "name": "Doctrine ORM",
    "kind": "orm",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "doctrine/orm"
      }
    ]
  },
  {
    "id": "composer-twig",
    "name": "Twig",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "twig/twig"
      }
    ]
  },
  {
    "id": "composer-slim",
    "name": "Slim",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "slim/slim"
      }
    ]
  },
  {
    "id": "composer-laravel",
    "name": "Laravel",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "laravel/framework"
      }
    ]
  },
  {
    "id": "composer-symfony",
    "name": "Symfony",
    "kind": "library",
    "ecosystemDependencies": [
      {
        "ecosystem": "composer",
        "name": "symfony/framework-bundle"
      }
    ]
  }
];
