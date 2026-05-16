# PRISM Design System

> Stock Tracker 앱(KOSPI·KOSDAQ)의 시각 아이덴티티 가이드.
> 모티프는 "분광(spectrum)" — 하나의 빛이 굴절해 여러 색으로 갈라지는 순간을 UI 전반의 글로우와 그라데이션으로 표현한다.

## 1. Visual Theme & Atmosphere

PRISM은 한국 증시 데이터를 다루는 다크-그린 / 크림-그린 듀얼톤 인터페이스다. 한국 증시 관행(상승=빨강, 하락=파랑)을 색의 출발점으로 삼되, 거기에 **분광 컨셉**을 얹어 그린(브랜드) → 블루(차분/하락) → 레드(활동/상승) → 골드(프리미엄·로고)로 이어지는 4색 스펙트럼을 시그니처로 한다.

**Key Characteristics:**
- 분광 4색 팔레트 — 단일 브랜드 컬러가 아니라 **스펙트럼 자체가 브랜드**
- Dark green 사이드바(`#2b5d3c`) ↔ Cream green 본문(`#f7faf4`) 듀얼 표면
- **Radial glow + hairline gradient**가 평평한 단색을 대체
- 의인화 마스코트(Mr. Stock Buddy / Morinaga gold)와 미스틱한 분광 톤의 공존
- 한글 명조/고딕 + 영문 모노 혼용 — 신뢰감과 데이터감의 동시 표현
- 시그니처 마이크로 모티프: **글로우 닷 + 트레일 링** (PRISM 커서에서 추출)

## 2. Color Palette & Roles

### Spectrum (브랜드 4색)
| Token | Hex | 역할 |
|---|---|---|
| `--green` | `#386948` | Primary 브랜드, CTA, 액티브 강조 |
| `--green-deep` | `#2b5d3c` | 사이드바 베이스, 글로우 닷 코어 |
| `--green-soft` | `#abe1b7` | 다크 표면 위 본문/링/구분선 글로우 |
| `--green-pale` | `#b9efc5` | 약한 강조, 호버 백드롭 |
| `--blue` | `#436B95` | 하락 / 보조 강조 / 분광 mid-tone |
| `--blue-deep` | `#2C4A6E` | 차트 깊은 톤 |
| `--blue-soft` | `#6B8AAE` | 본문 보조 텍스트 |
| `--red` | `#B5453F` | 상승 / 강한 액션 / 분광 warm-end |
| `--yellow` | `#745c27` | 경고·강조 텍스트 |
| `--morinaga-gold` | `#D4A030` | 프리미엄 / 로고 정체성 (분광 4번째 축) |
| `--morinaga-wine` | `#5A1810` | 로고 깊은 톤 |

### Neutral
| Token | Hex | 역할 |
|---|---|---|
| `--bg` | `#f7faf4` | 본문 베이스 |
| `--surf` | `#f0f5ee` | 카드 표면 |
| `--surf2` | `#e9f0e8` | 카드 보조 |
| `--border` | `#abb4ac` | 카드 보더 |
| `--fg` | `#2c342e` | 본문 텍스트 |
| `--muted` | `#59615a` | 보조 텍스트 |

### Semantic (한국 증시 관행)
- **상승(up)**: `--red`
- **하락(down)**: `--blue`
- **보합(flat)**: `--muted`

### 분광 글로우 레시피 (시그니처)
다크 표면 위에서 *반드시* 4축이 다 들어간 그라데이션을 사용한다. 단색 fill은 금지.

```css
/* hairline spectral divider */
background: linear-gradient(90deg,
  transparent 0%,
  rgba(171,225,183,0.30) 25%,   /* green-soft */
  rgba(67,107,149,0.30) 55%,    /* blue */
  rgba(181,69,63,0.20) 80%,     /* red */
  transparent 100%);

/* spectral box-shadow stack (글로우 닷 표준) */
box-shadow:
  0 0 8px  rgba(171,225,183,0.65),  /* green halo */
  0 0 18px rgba(67,107,149,0.45),   /* blue mid */
  0 0 32px rgba(181,69,63,0.25);    /* red far */
```

## 3. Typography Rules

### Font Families
- **Display / 마루(serif)**: `Nanum Myeongjo` — 헤더, 브랜드 텍스트, 의례감
- **UI / Body**: `Nanum Gothic`, fallback: `Pretendard, -apple-system`
- **Mono / Data**: `JetBrains Mono` — 숫자, 글리프 아이콘, 코드

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| Display Hero | Nanum Myeongjo | 36px | 800 | 1.20 | -0.5px |
| Section Heading | Nanum Myeongjo | 24px | 700 | 1.25 | -0.3px |
| Sub-heading | Nanum Gothic | 18px | 700 | 1.30 | 0.02em |
| Card Title | Nanum Gothic | 15px | 700 | 1.35 | 0.01em |
| Body | Nanum Gothic | 14px | 400 | 1.7 | normal |
| Body Strong | Nanum Gothic | 14px | 700 | 1.7 | normal |
| Menu Item | Nanum Gothic | 14.4px (0.9rem) | 500 / 700(active) | 1.5 | 0.01em |
| Caption | Nanum Gothic | 12px | 500 | 1.4 | 0.04em |
| Eyebrow | Nanum Gothic | 10.5px (0.66rem) | 700 | 1.4 | 0.18em uppercase |
| Numeric Data | JetBrains Mono | 13–14px | 400–700 | 1.4 | normal |

> **아이콘 정책**: 사이드바·헤더·버튼·뱃지 등 기본 내비게이션과 라벨에는 **어떤 아이콘도 사용하지 않는다**. 이모지(📰 🤖)는 물론, 장식적 유니코드 글리프(`◉ ▦ △ ✧ ◈ ❖ ✦`)도 모두 금지. 정보 위계는 타이포그래피·간격·active state 인디케이터로 표현한다. 정보 전달용 아이콘이 정말 필요한 좁은 케이스에서만 lucide/Heroicons 같은 단색 outline SVG(stroke 1.5px / 16–18px)를 검토.

## 4. Component Stylings

### Buttons

**Primary (다크 표면)** — 분광 보더 + green-deep 베이스
- bg: `linear-gradient(180deg, rgba(56,105,72,0.95), rgba(43,93,60,0.95))`
- color: `#F0F7EE`
- border: `1px solid rgba(171,225,183,0.30)`
- radius: `3px`
- hover shadow: `0 0 0 1px rgba(171,225,183,0.15), 0 0 14px rgba(67,107,149,0.35)`

**Ghost (다크 표면)** — 텍스트 + hairline 보더
- bg: `transparent`
- color: `rgba(171,225,183,0.85)`
- border: `1px solid rgba(171,225,183,0.30)`
- radius: `3px`
- hover: 보더 → `rgba(67,107,149,0.65)`, 적색 톤 분광 shadow

**Primary (라이트 표면)** — `--green` solid, radius `4px`
**Outlined (라이트 표면)** — `--green` 1px border, transparent bg

> **버튼 radius는 3–4px**. 핀테크/거래소 스타일의 12px+ 라운드는 우리 톤이 아니다.

### Cards (`.bh-card`)
- bg: `--surf`
- border: `1px solid --border`
- **top border 2px solid --green** (시그니처 — 카드 위에 분광 시작점을 깔아둔다)
- radius: `4px`
- padding: `16px`

### Badges
- Premium / Admin: `--morinaga-gold` 텍스트, 보더 없음, micro eyebrow
- Free: `rgba(171,225,183,0.75)` 텍스트
- Up/Down: 텍스트 컬러만 `.up`/`.down` 클래스, 배경 없음

### Glow Dot (시그니처 마이크로 컴포넌트)
PRISM 커서의 dot과 동형. 푸터 호흡 닷·로딩 상태에서 재사용.
- size: `5–6px`
- bg: `--green-deep` (정지) / `--green-soft` (활성) / `--red` (호버)
- shadow: **분광 3단 스택** (위 레시피 참조)

### Vertical Spectral Accent Bar (내비게이션 활성 표시)
사이드바·탭 등 1차 내비게이션의 활성 상태 표시. Linear / Vercel 톤.
- 좌측 부착, width `2px`, height: 항목 높이 - 16px
- background: `linear-gradient(180deg, green-soft → blue → red)` (분광 4축 압축)
- box-shadow: soft glow (`0 0 8px green-soft alpha 0.55, 0 0 14px blue alpha 0.35`)
- 등장 전환: `transform: scaleY(0 → 1)` 240ms cubic-bezier(0.22, 1, 0.36, 1)

### Spectral Underline
hairline 그라데이션. 활성 메뉴·섹션 헤더·카드 강조에 사용.
- height: `1px`
- transform: `scaleX(0)` → `scaleX(1)` 전환 280ms

## 5. Layout Principles

### Spacing scale
**허용값만 사용**: `2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48`
> 5px / 7px / 9px 같은 어중간한 값 금지.

### Border Radius scale
**허용값**: `2, 3, 4, 6, 50%`
> Kraken식 12px+ pill 라운드 금지. 우리는 거의 사각에 가까운 톤.

### Grid
- 사이드바 폭: 220px (고정)
- 본문 max-width: 1280px (필요 시 1440px)
- Card gutter: 16px

## 6. Depth & Elevation

평평한 그림자가 아니라 **분광 글로우 티어** 시스템.

| Tier | 용도 | 값 |
|---|---|---|
| Whisper | 카드 hover | `0 1px 4px rgba(67,107,149,0.10)` |
| Soft Glow | 활성 dot, 버튼 hover | `0 0 8px rgba(171,225,183,0.45), 0 0 18px rgba(67,107,149,0.30)` |
| Spectral | 강조 dot, 프리미엄 강조 | `0 0 8px rgba(171,225,183,0.85), 0 0 18px rgba(67,107,149,0.55), 0 0 32px rgba(181,69,63,0.30)` |
| Wash | 표면 백드롭 | `radial-gradient(120% 60% at 0% 0%, rgba(67,107,149,0.10), transparent 55%)` |

## 7. Do's and Don'ts

### Do
- 분광 4축(green / blue / red / gold)을 한 화면 안에 *최소 흔적이라도* 동시에 존재시킨다.
- 다크 표면 위에는 **반드시 radial wash 또는 hairline gradient**를 깐다.
- 활성 상태는 *글로우 닷 + spectral underline* 콤보로 표현.
- 한국 증시 관행(red=up, blue=down)을 지킨다.
- 아이콘은 단색 유니코드 글리프 + 모노 폰트.

### Don't
- 평평한 단색 fill로 표면을 채우지 않는다. (그라데이션 또는 wash 없는 단색 = 금지)
- 컬러 이모지(📰 🤖 ⭐)를 UI 라벨에 쓰지 않는다.
- 버튼 radius 6px 초과 금지. pill 형태 금지.
- 단일 색만 강조하는 monochrome 글로우 금지 — 분광 3색 이상 스택.
- 색만으로 의미를 전달하지 않는다 (글로우 + 글리프 + 텍스트 라벨 동반).

## 8. Responsive Behavior
Breakpoints: `640px`, `768px`, `1024px`, `1280px`

- `<768px`: 사이드바 → 상단 햄버거 드로워, PRISM 커서 자동 비활성 (touch 환경)
- `≥1280px`: 본문 12-col grid, 사이드바 sticky 유지

## 9. Agent Prompt Guide

### Quick Color Reference
- 브랜드 스펙트럼: green `#386948` → blue `#436B95` → red `#B5453F` → gold `#D4A030`
- 다크 사이드바: `#2b5d3c`
- 라이트 본문: `#f7faf4`
- 본문 텍스트: `#2c342e`
- 보조 텍스트: `#59615a`

### Example Prompts
- "다크 사이드바 위 활성 메뉴: 좌측에 5px 글로우 닷(green-soft + 분광 3단 shadow), 하단에 1px spectral underline (green→blue→red 그라데이션), 폰트는 Nanum Gothic 0.9rem 700."
- "라이트 본문 카드: surf 배경, 1px border, top 2px green 보더, radius 4px, hover 시 whisper shadow."
- "프리미엄 뱃지: morinaga-gold 텍스트, eyebrow 타이포(10.5px / 700 / 0.18em / uppercase), 배경 없음, 좌측 ★ 글리프."

## 10. 시그니처 모티프 3종 (반드시 알아둘 것)

1. **글로우 닷 + 트레일 링** — PRISM 커서. 활성/포커스/로딩 상태의 시각적 원형.
2. **Spectral Hairline** — 1px 그라데이션. 구분선·underline·카드 top border 모두 같은 DNA.
3. **Radial Spectral Wash** — 다크 표면 좌상단 청색·우하단 적색 라디얼. 표면이 "빛을 받는 면"으로 보이게.

이 셋 중 *하나도* 들어가지 않은 화면은 PRISM이 아니다.
