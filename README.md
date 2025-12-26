## Requirements
pnpm
pnpm install

## How to run
pnpm run dev

## Structure
```
acro-landing/
├── public/
│   ├── favicon.ico
│   ├── og-image.png              # Open Graph 이미지
│   ├── robots.txt
│   └── images/
│       └── team/                  # 팀 이미지
│
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Navigation.astro
│   │   │   └── Footer.astro
│   │   │
│   │   ├── sections/
│   │   │   ├── HeroSection.astro
│   │   │   ├── TeamSection.astro
│   │   │   ├── AITechSection.astro
│   │   │   ├── PricingSection.astro
│   │   │   ├── TestimonialsSection.astro
│   │   │   └── ContactSection.astro
│   │   │
│   │   └── interactive/
│   │       ├── SurveyWidget.tsx   # React 컴포넌트 (hydration)
│   │       └── TerminalDemo.astro
│   │
│   ├── layouts/
│   │   └── BaseLayout.astro       # 공통 레이아웃
│   │
│   ├── pages/
│   │   ├── index.astro            # 메인 랜딩 페이지
│   │   ├── reviews/               # 향후 고객후기 페이지
│   │   │   └── index.astro
│   │   └── team/                  # 향후 구성원 상세 페이지
│   │       └── [slug].astro
│   │
│   ├── content/                   # 콘텐츠 컬렉션 (향후)
│   │   ├── reviews/
│   │   │   └── review-001.md
│   │   └── team/
│   │       └── lawyer-k.md
│   │
│   ├── styles/
│   │   └── global.css             # 전역 스타일 (애니메이션 등)
│   │
│   └── utils/
│       └── api.ts                 # API 호출 함수
│
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```