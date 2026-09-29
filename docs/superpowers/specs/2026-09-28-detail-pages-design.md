# On the Book: 작품 상세 페이지(두 열) 설계

작성일 2026-09-28. 사용자 화면(client) 홈의 "지금 만나볼 이야기"와 "한 장면부터 시작하는 여행" 카드가 3D 월드로 바로 들어가는 대신 **작품 상세 페이지** 하나를 거치고, 그 페이지의 장면 패널 CTA 로만 3D 월드에 진입하도록 바꾸는 설계다.

## 0. 이력

- 처음에는 작품 상세(`?book=`)와 장면 상세(`?book=&scene=`) 두 페이지(두 뎁스)로 설계·구현했다(PR #3, 커밋 c60f7b6 까지). 같은 날 사용자가 밀리의서재 도서 상세처럼 **한 페이지 두 열**로 합치기로 결정했다. 왼쪽 열은 스크롤되는 작품 정보와 장면 목록, 오른쪽은 스크롤을 따라다니는 장면 패널이다.
- 이 문서는 그 결정 이후의 최종 설계다. 두 뎁스 구현에서 바뀌는 점은 18절에 모았고, 구현 계획은 그 차이만 다룬다.
- 그보다 앞서 정한 것(카드가 링크가 되는 홈 변경, 주소 규칙의 골격, `book-meta.js`·`detail.js` 분리, 표지·썸네일 표시)은 그대로 유효하다.
- 2026-09-29 사용자 요청으로 두 가지를 더했다. 장면 패널과 시트의 스크롤바를 숨겼고(5절), '이 책의 여정' 다음에 저자 소개·책 소개 섹션과 이를 입력하는 관리자 칸을 넣었다(19절). 처음에는 빈 칸의 섹션을 숨겼으나, 같은 날 사용자 요청으로 섹션을 두고 '준비 중' 문구를 보이게 바꿨다. 이어서 왼쪽 열 섹션 사이의 구분선을 모두 없앴다(6절). 그다음 작품 상세에서 푸터와 헤더의 소개·책장으로·물음표를 빼 로고만 남기고, 장면 패널을 스크롤을 따라오는 sticky 대신 화면 높이에 고정했다(5절). 이어서 패널의 미리 읽기와 그 아래 글을 없애고 이전·다음을 CTA 아래 같은 너비의 버튼 둘로 옮겼으며(7절), 왼쪽 열의 원작 정보 섹션을 없앴다(6절). 이어서 작품 상세에도 홈과 같은 띠 배너와 헤더(로고·검색·소개·책장·이용 방법)를 두어 850px 초과에서 위에 고정하고, 장면 패널은 카드를 벗고 그 아래부터 화면 끝까지 채우며 왼쪽 열과는 선 하나로 나눴다(5절). 이어서 페이지 위아래 여백을 넓혔다(6절). 그다음 여정 행의 대표 모델 이름을 없애고 작품 상세의 12px 글자를 14px 로 올렸으며(6절), 마지막으로 히어로를 연도·한글 제목·저자만 남기고 패널의 "이 장면에서 만나는 것들"을 없앴다(6절·7절).

## 1. 배경과 목표

원래 `client/main.js` 는 `exploring` 참·거짓 하나로 책장 홈과 3D 월드 두 화면을 오갔고, 홈의 도서 카드·장면 카드·추천 히어로 카드는 모두 `enterBook()` 을 바로 불러 3D 월드로 들어갔다. 작품 정보는 3D 월드 안의 "작품 소개" 모달에서만 볼 수 있었다.

사용자가 정한 방향은 다음과 같다.

- 홈의 카드는 모두 **작품 상세** 한 페이지로 이동한다. 장면 카드는 그 장면이 선택된 상태로 연다. 페이지의 장면 패널에 있는 CTA "이 장면부터 걷기"가 3D 월드 진입의 유일한 입구다.
- 구조는 A 안이다. 기존 SPA(`client/main.js`) 안의 화면 상태와 쿼리 주소를 쓴다. 별도 진입점이나 경로형 주소는 쓰지 않는다.
- 레이아웃은 밀리의서재 도서 상세를 따른다. 왼쪽 열은 페이지와 함께 스크롤되고, 오른쪽 장면 패널은 화면 높이에 고정되어 스크롤해도 움직이지 않는다(처음에는 `position: sticky` 로 따라다니게 했다). 장면 목록에서 행을 누르면 페이지를 옮기지 않고 오른쪽 패널만 그 장면으로 바뀐다.
- 패널은 항상 장면 하나를 보여 준다(1안). 처음에는 저장된 장면("이어 읽기")이 있으면 그 장면, 없으면 첫 장면이 선택되어 있다. 작품 단위의 "이야기 속으로 들어가기"·"처음부터 시작하기" 버튼은 두지 않는다. 주 CTA 가 한 곳에만 있어야 흐름이 단순하다.
- 상세 페이지는 관리자가 올린 표지(`book.cover`)와 장면 썸네일(`chapter.thumbnail`)을 보여 주고, 등록되지 않은 칸은 이름표(`aria-label`)가 달린 빈 자리로 둔다(2026-09-28 홈 화면 관리 PR #2 반영). 모델 썸네일은 표시하지 않는다.

기준 스택은 현재 client(Vite 멀티 페이지 + 바닐라 JS + npm `three` 0.180)다. React·Next 전환은 전환 스펙 6단계에서 하며, 이 설계의 주소 규칙과 화면 구성을 그때 그대로 옮긴다.

## 2. 범위와 비범위

범위
- 작품 상세 한 화면(`?book=`, `?book=&scene=`). 두 열 뼈대, 왼쪽 열(히어로·여정·저자 소개·책 소개), 오른쪽 장면 패널, 850px 이하의 장면 시트와 하단 고정 CTA.
- 홈 카드 연결(도서 카드, 장면 카드, 추천 히어로 카드, "읽던 이야기" 카드). 직행 경로는 남기지 않는다.
- 주소 해석, 브라우저 히스토리, 커튼 전환, 초점 이동, 책장 위치 복원, 장면 선택의 주소 반영.
- 검사(`tests/detail.test.js`, `tests/catalog.mjs`, `tests/mobile-entry.mjs`, `tests/home-admin.mjs` 의 상세 부분, `tests/capture.mjs`), README, `docs/ADMIN-GUIDE.md`, `client/index.html` 설명 문구, 전환 스펙 10절.

비범위
- 서버, `client/vercel.json`, `server/index.js` 변경. `shared/schema.js` 와 관리자 화면은 19절의 소개 필드 두 개와 15절의 도움말 문구 한 줄만 바꾼다. 상세 페이지가 쓰는 정보는 모두 `/api/library`(초안 미리보기는 `/api/studio`) 응답에 들어 있다.
- 라이브 3D 미리보기(`World` 의 `hero` 모드). 카드마다 캔버스를 띄우면 진입이 느려지고 CTA 의 "본격 진입" 의미가 약해진다.
- 3D 월드 안의 "작품 소개" 모달과 "이야기의 지도" 모달의 내용·동작 변경. 모달은 탐험을 끊지 않기 위해 그대로 둔다.
- 새 저장 데이터. 기존 `otb-reader` 의 `{ [bookId]: { chapter } }` 만 읽는다. 패널의 선택은 주소(`&scene=`)에만 반영하고 저장하지 않는다.
- 홈의 검색·분류·정렬·빠른 메뉴·트레일러·이용 가이드 변경. 소개 페이지(`/about`) 변경.
- 경로형 주소(`/books/alice`). Next App Router 로 옮길 때 다시 정한다.

## 3. 화면 상태와 주소

`main.js` 의 화면 상태 `view` 는 `home`, `book`, `world` 셋이다. `book` 화면은 선택된 장면(`chapter` 변수)을 함께 가진다.

| view | 주소 | 화면 | 전환 후 초점 |
| --- | --- | --- | --- |
| `home` | `/client/` | 책장 홈(기존) | `#library-title`(기존) |
| `book` | `/client/?book=alice` | 작품 상세. 패널은 저장된 장면 또는 첫 장면 | `#detail-title` |
| `book` | `/client/?book=alice&scene=alice-2` | 같은 작품 상세. 패널은 2장면, 여정의 2행이 선택 상태 | `#detail-title` |
| `world` | `/client/?book=alice&chapter=alice-1` | 3D 월드(기존) | `#world canvas`(기존) |

주소 해석은 `init()` 과 `popstate` 가 같은 함수 `resolveView(params)` 를 쓴다.

1. `book` 이 `library.books` 에 없으면 `home`. 주소는 `history.replaceState` 로 `preview` 만 남기고 지운다(`scene`·`chapter` 만 있어도 같다). 초안 미리보기(`?preview=draft`)에서는 비공개 도서도 `library.books` 에 있으므로 그 상세와 월드 주소가 열리고, 홈 책장에만 공개 도서가 보인다.
2. `chapter` 가 그 책의 챕터면 `world`.
3. 아니면 `scene` 이 그 책의 챕터면 `book`, 선택 장면은 그 챕터, `sceneAddressed = true`.
4. 아니면 `book`, 선택 장면은 기본 장면(저장된 장면이 이 책의 챕터면 그것, 아니면 첫 장면), `sceneAddressed = false`. `scene` 이나 `chapter` 가 잘못된 값이면 주소를 `?book=` 으로 고쳐 둔다.

`sceneAddressed` 는 주소에 `scene` 을 적을지 정하는 모듈 변수다. 사용자가 여정 행이나 패널의 이전·다음을 눌러 장면을 고르면 `true` 가 되어 그때부터 `currentUrl()` 이 `&scene=` 을 붙인다. 기본 선택만 있는 `?book=alice` 는 그대로 `?book=alice` 로 남는다. 그래야 홈 카드로 들어온 주소가 깨끗하고, 장면을 고른 뒤에는 새로고침·공유·뒤로가기가 선택을 유지한다.

주소 생성은 `client/detail.js` 의 `detailUrl({ book, scene, chapter, preview })` 한 곳에서 한다(기존). `?preview=draft` 는 모든 주소에 붙는다. `main.js` 의 `currentUrl()` 은 `view === "book"` 이면 `detailUrl({ book: book.id, scene: sceneAddressed ? chapter.id : undefined, preview })` 다.

문서 제목은 `render()` 에서 화면마다 바꾼다. `book` 은 선택 장면과 무관하게 `이상한 나라의 앨리스 — On the Book`, `home`·`world` 는 기존 `On the Book — 책 속을 걷는 시간` 이다.

## 4. 이동 흐름

화면(`view`)이 바뀌는 이동은 모두 기존 `transitionPage(app, update, { label })` 커튼을 거친다. 같은 작품 상세 안에서 장면만 바꾸는 조작은 커튼 없이 패널만 다시 그린다.

| 출발 | 조작 | 도착 | 히스토리 | 커튼 문구 |
| --- | --- | --- | --- | --- |
| 홈 | 도서 카드, 히어로 카드, 읽던 이야기 카드 | 작품 상세(기본 장면) | `pushState` `?book=` | 작품을 펼치는 중이에요… |
| 홈 | 장면 카드 | 작품 상세, 그 장면 선택(`sceneAddressed = true`) | `pushState` `?book=&scene=` | 작품을 펼치는 중이에요… |
| 작품 상세 | 여정 행 | 같은 페이지, 패널이 그 장면으로 바뀜 | `replaceState` `?book=&scene=` | 없음 |
| 작품 상세 | 패널의 이전·다음 장면 | 같은 페이지, 이웃 장면 | `replaceState` | 없음 |
| 작품 상세(850px 이하) | 여정 행 | 장면 시트가 열리고 패널 내용이 그 안에 보임. 선택도 바뀜 | `replaceState` | 없음 |
| 작품 상세 | 패널·시트·하단 바의 CTA "이 장면부터 걷기" | 3D 월드, 선택된 장면 | `pushState`(`enterBook(id, sceneId)`) | 이야기 속으로 들어가는 중이에요…(기존) |
| 작품 상세 | 로고, 헤더의 책장 아이콘 | 홈. 책장 스크롤 위치와 카드 초점 복원 | `pushState` | 책장으로 돌아가는 중이에요…(기존) |
| 작품 상세 | 띠 배너 | 홈의 장면 목록. 검색·분류를 풀고 `#scene-title` 로 스크롤·초점 | `pushState` | 책장으로 돌아가는 중이에요… |
| 작품 상세 | 헤더 검색창에서 Enter(한글 조합을 끝내는 Enter 는 제외) | 홈의 검색 결과. 맨 위, 검색창에 검색어와 초점 | `pushState` | 책장으로 돌아가는 중이에요… |
| 3D 월드 | "책장으로" | 홈(기존) | `pushState` | 기존 |
| 어디서든 | 브라우저 뒤로·앞으로 | 주소가 가리키는 화면 | `popstate` | 문구 없음(기존) |

- 장면 선택은 히스토리 항목을 만들지 않는다. 3D 월드에서 뒤로가기를 누르면 마지막에 선택했던 장면이 주소에 남아 있어 그 장면이 선택된 작품 상세로 돌아온다. 한 번 더 누르면 홈이다.
- 홈에서 상세로 갈 때 `catalogState.scroll` 과 누른 카드의 선택자(`[data-book="alice"]`, `[data-scene-chapter="alice-2"]`, `[data-feature-book="alice"]`)를 저장하고 `restoreCatalogPosition()` 이 초점을 되돌린다(기존).
- 장면을 고르면 초점은 누른 여정 행(또는 패널의 이전·다음 버튼)에 남는다. 새 패널에서 같은 쪽 버튼이 흐린 자리면 CTA 로 옮긴다. 패널은 안쪽 스크롤을 맨 위로 되돌리고, 시각적으로 숨긴 `role="status"` 문구 "`02 작아지는 문, 커지는 세계` 장면을 골랐어요"가 바뀐다. 패널 전체를 `aria-live` 로 두면 매번 패널을 통째로 읽어 주므로 그렇게 하지 않는다.
- `popstate` 는 열린 `dialog`(장면 시트 포함)를 닫고 `resolveView()` 결과로 다시 그린다. 홈으로 돌아온 경우에만 `restoreCatalogPosition()` 을 부른다(기존).

## 5. 공통 셸과 두 열 뼈대

헤더는 `home` 과 `book`(작품 상세)이 같다. 로고, 검색창, 소개, 아이콘 책장 버튼("책장 홈"), 이용 방법(물음표)이다. `world` 는 소개·글자 버튼 "책장으로"(`reader-header` 모양)·소리·이용 방법이다(기존). `book` 은 홈의 띠 배너(`announcementBanner()`)도 함께 둔다. 2026-09-29 사용자 요청으로 한동안 로고만 두었다가, 같은 날 "로고 + 검색 + 띠배너, 이 GNB 가 상세에도 똑같이" 요청으로 홈과 같게 바꿨다.
- `book` 의 띠 배너와 헤더는 `div.detail-top` 으로 묶는다. 850px 초과에서는 `position: sticky; top: 0`(z-index 6, 흰 배경)으로 늘 위에 붙어 있어 장면 패널이 그 아래를 채울 수 있다. 850px 이하에서는 함께 스크롤된다.
- 띠 배너를 누르면 홈의 장면 목록으로 간다(4절 표). 검색창은 홈처럼 입력마다 거르지 않고, Enter 를 누르면 그 검색어로 홈의 검색 결과를 연다. 검색창 초점은 `transitionPage()` 의 `focus` 가 아니라 전환 뒤에 직접 준다(그 경로는 `tabindex="-1"` 을 붙여 검색창을 Tab 순서에서 뺀다).
- 전역 `button:hover` 색이 띠 배너 글자를 녹색 배경에 묻히게 해서, `.reading-ribbon:hover` 가 흰 글자를 유지한다(홈에도 있던 문제).
- 푸터는 `home` "오래된 이야기, 새로운 발견.", `world` "문장 너머의 세계를, 천천히."(기존)이고, `book` 에는 푸터가 없다.

작품 상세의 뼈대는 다음과 같다.

```
div.detail-top                    띠 배너 + 헤더. 850px 초과에서 위에 고정(sticky)
  button.reading-ribbon
  header.site-header              홈과 같은 헤더(검색창 포함)
main.detail-page.store-content#main-content[data-view="book"]
  div.detail-main                 왼쪽 열. 페이지와 함께 스크롤
    section.detail-hero           표지·연도·한글 제목·저자
    section.detail-section#detail-journey   이 책의 여정(장면 목록)
    section.detail-section.detail-intro#detail-author       저자 소개(비어 있으면 준비 중 문구, 19절)
    section.detail-section.detail-intro#detail-book-intro   책 소개(비어 있으면 준비 중 문구, 19절). 왼쪽 열의 끝
  aside.scene-panel[aria-labelledby="panel-scene-title"]   오른쪽 열. 고정된 윗부분 아래부터 화면 끝까지(fixed)
    (7절의 패널 내용)
  div.detail-cta                  850px 이하에서만 보이는 하단 고정 바
  p.reader-sr-only[role="status"]#scene-status   장면 선택 안내
```

- 1101px 이상: `grid-template-columns: minmax(0, 1fr) 400px`, 열 간격 48px. 851~1100px: 오른쪽 열 340px, 간격 32px. 850px 이하: 한 열. `.store-content` 로 홈과 같은 1280px 폭과 좌우 여백을 쓴다.
- 오른쪽 `aside.scene-panel` 은 `position: fixed; top: var(--detail-top, 138px); bottom: 0` 이다. 고정된 윗부분(`.detail-top`) 바로 아래에서 화면 아래 끝까지 채우고, 페이지 맨 위에서 끝까지 스크롤해도 같은 자리에 있다. 카드 모양(사방 테두리·모서리)은 없고, 왼쪽 1px 선(`#e7ebe7`) 하나로 왼쪽 열과 나눈다. 흰 배경, 안쪽 여백은 위 `--detail-space-top`(72px)·아래 48px·왼쪽 32px·오른쪽 0 이다(6절의 위아래 여백)(2026-09-29 사용자 요청. 그 전에는 처음에 `position: sticky` 로 따라다니다가, 위아래 24px 여백을 둔 고정 카드였다).
  - `--detail-top` 은 `setupDetail()` 이 `ResizeObserver` 로 잰 `.detail-top` 높이를 `.detail-page` 에 적은 값이다. 기본값 138px 은 띠 배너 50px 과 헤더 88px 을 더한 값이다.
  - 오른쪽 끝은 `.store-content` 콘텐츠 상자의 오른쪽 끝, 곧 헤더 아이콘 줄의 오른쪽 끝에 맞춘다(`right: max(40px, calc((100% - 1280px) / 2 + 40px))`, 851px 이상의 좌우 여백 40px). 폭은 격자의 오른쪽 열과 같은 400px(1100px 이하 340px)이고, 격자의 오른쪽 열은 비워 둬서 왼쪽 열 폭은 그대로다.
  - `z-index: 4` 로 `.detail-top`(6)·알림(100)·커튼(1000) 아래에 둔다. 패널이 화면보다 길면 패널 안에서만 스크롤되고, 스크롤바는 보이지 않게 숨긴다(`scrollbar-width: none`, 사파리용 `::-webkit-scrollbar`).
- 850px 이하에서는 `aside.scene-panel` 을 `display: none` 으로 숨긴다. 같은 내용은 여정 행을 눌렀을 때 장면 시트(7절)로 보인다. 하단 고정 바 `.detail-cta` 는 851px 이상에서 `display: none` 이다. 그래서 어떤 폭에서도 보이는 CTA 는 하나이고, 숨긴 쪽은 접근성 트리에서도 빠진다.
- 등장 순서: `transitions.js` 의 `reveal()` 에서 `.detail-page` 그룹은 `[".site-header", ".detail-hero", "#detail-journey, .detail-intro", ".scene-panel, .detail-cta"]` 다(작품 상세에는 원작 정보와 푸터가 없다).
- 전환 후 초점은 `h1#detail-title`(책 제목, `tabindex="-1"`). `transitionPage()` 의 기본 초점 대상 순서 `#library-title` → `#detail-title` → `#world canvas, #fallback-read` 는 기존과 같다.

## 6. 왼쪽 열

`client/detail.js` 의 `bookDetail({ book, chapter, library, progress, preview })` 가 페이지 전체(왼쪽 열 + 패널 + 하단 바 + 상태 문구)를 돌려준다. `chapter` 는 선택된 장면이다.

왼쪽 열의 섹션(히어로, 이 책의 여정, 저자 소개, 책 소개) 사이에는 구분선이 없고 여백으로만 나눈다. 섹션 위 여백은 70px(600px 이하 58px)다.

페이지 위아래 여백(2026-09-29 사용자 요청, "상단과 하단에 충분한 여백으로 시각적 안정감")
- 851px 이상: 고정된 윗부분(`.detail-top`) 아래 72px 에서 히어로가 시작한다(`.detail-page` 의 `--detail-space-top`, 히어로의 `margin-top` 은 없앴다). 장면 패널의 안쪽 위 여백도 같은 변수라, 첫 화면에서 표지와 장면 이미지의 윗선이 맞는다. 마지막 섹션 뒤에는 120px, 패널 안쪽 아래는 48px 이다.
- 850px 이하: 위 44px. 마지막 섹션과 하단 고정 바 사이는 64px(`.detail-main` 의 아래 여백)이고, `.detail-page` 의 아래 여백은 0 이라 페이지 끝에서도 바가 화면 바닥에 붙어 있다.
- `.detail-page.store-content` 두 클래스로 써서 `landing.css` 의 `.store-content` 여백을 모든 폭에서 이긴다. 좌우 여백은 `.store-content` 그대로다. 여정 목록의 행 구분선과 장면 패널 안의 구분선은 그대로 둔다(2026-09-29 사용자 요청).

히어로 `.detail-hero`
- 왼쪽: `bookCover(book)` 자리(`.catalog-cover.image-placeholder`, 2:2.85). 표지가 등록되어 있으면 그 `<img>`(`alt=""`), 없으면 `role="img" aria-label="표지 이미지 준비 중"` 인 빈 자리. 데스크톱 160px, 600px 이하 112px, 370px 이하에서는 위로 올라가 가운데 130px.
- 오른쪽은 세 줄이다. `.eyebrow` 출간 연도 "1865", `h1#detail-title` 한글 제목, `p.detail-meta` 저자(비어 있으면 줄을 뺀다). 2026-09-29 사용자 요청("연도, 도서명(한글만), 저자명만")으로 분류·장면 수·영문 제목·소개 문장(`p.detail-description`)을 뺐다. 소개 문장은 홈 추천 배너의 기본 설명과 3D 화면의 작품 소개 창에 남고, 관리자 도움말도 그렇게 고쳤다.
- 히어로에는 버튼이 없다. CTA 는 패널에만 있다.

여정 `.detail-section#detail-journey`
- `h2` "이 책의 여정", 설명 `p` "장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요."(850px 이하에서는 CSS 로 "장면을 고르면 그 장면을 먼저 볼 수 있어요." 를 보인다. 두 문구를 `span` 둘로 넣고 폭에 따라 하나만 보인다.)
- `<ol class="journey-list">` 안에 챕터 순서대로 `<li><a class="journey-row" href="{detailUrl scene}" data-scene="alice-2" aria-current="true|false">`. 행 안: 테마 칩 `.theme-chip[data-theme]`(`aria-hidden`), 번호 `01`, `strong` 제목, `small` 부제, 배지 `.journey-badge` "마지막에 머문 장면"(저장된 장면 행 하나), `chevron-right` 아이콘. 행에는 대표 모델 이름을 두지 않는다(2026-09-29 사용자 요청으로 `span.journey-model` "· 조끼 입은 흰 토끼"를 없앴다. 장면의 모델은 3D 공간에서 만난다).
- 선택된 행은 `aria-current="true"` 이고 연한 배경(`#f0f4ef`)과 왼쪽 3px 강조선(`--accent`)을 갖는다. 나머지는 `aria-current="false"`.
- 행은 진짜 링크다. 수정키 클릭·가운데 클릭은 브라우저에 맡겨 `?book=&scene=` 을 새 탭으로 열 수 있고, 일반 클릭은 `preventDefault()` 뒤 장면 선택(4절)이다.
- 작은 글자는 14px 이다. 히어로의 `.eyebrow`(연도)와 패널·시트의 `.eyebrow`("장면 02 / 06")가 12px(히어로 `.eyebrow` 는 600px 이하 11px)였는데, 2026-09-29 사용자 요청으로 모든 폭에서 14px 로 올렸다. 그때 함께 올린 `.panel-hint`·`.figure-story` 는 곧 모델 묶음과 함께 없앴다(7절). 13px(번호·부제·하단 바 문구)와 11px 배지는 그대로다.
- 테마 칩 색은 meadow `#cad7aa`, night `#929aaf`, tea `#d7c9b6`, rose `#d8c6b7`, gold `#dcca98`(3D 월드 바닥색).

저자 소개·책 소개 `.detail-section.detail-intro`
- 여정 다음에 저자 소개, 책 소개 순서로 늘 놓고, 책 소개가 왼쪽 열의 끝이다. 비어 있으면 본문 자리에 준비 중 문구를 보인다. 자세한 규칙은 19절.

원작 정보
- 2026-09-29 사용자 요청으로 작품 상세의 원작 정보 섹션(`.detail-source`, 권리 문구와 "원작 정보 보기 ↗")과 그 전용 코드·CSS·검사를 없앴다. 책 데이터의 `rights`·`source` 와 관리자 입력 칸, 공개 조건은 그대로이고, 권리·출처는 3D 공간 안의 "작품 소개" 창에서 계속 보인다.

## 7. 장면 패널

`scenePanel({ book, chapter, progress, preview })` 가 패널 안쪽 마크업을 돌려준다(모델 묶음을 없애 `library` 인자와 `mainPlacement()` 도 없앴다). `bookDetail()` 이 처음 그릴 때, 장면을 바꿀 때(`aside.scene-panel` 의 `innerHTML` 교체), 850px 이하의 장면 시트를 열 때 같은 함수를 쓴다. `chapter` 가 `book.chapters` 에 없으면 예외를 던진다.

순서와 내용
1. 이미지 `.scene-image.image-placeholder[data-theme]`: 패널 폭 전체, **항상 16:10**(`aspect-ratio: 16 / 10`), 모서리 10px, 배경은 테마 칩 색, 왼쪽 아래 `.scene-number` "02". 썸네일(`chapter.thumbnail`)이 있으면 `.has-image` 를 더하고 `<img>`(`alt=""`, `object-fit: cover`)가 자리를 채우며 번호는 밝은 알약 모양으로 위에 남는다. 이름표는 썸네일이 있으면 `aria-label="{장면 제목} 장면 이미지"`, 없으면 `"장면 이미지 준비 중"`. 패널이 좁아(340~400px) 16:10 이미지가 그대로 들어가므로 예전의 가로 띠와 잘림 문제가 없다.
2. `.eyebrow` "`장면 02 / 06`", `h2#panel-scene-title` 장면 제목, `p.detail-meta` 부제(비어 있으면 생략). 저장된 장면이면 제목 아래에 배지 "마지막에 머문 장면".
3. CTA: `<button class="primary-button detail-enter" data-enter="alice" data-enter-chapter="alice-2">이 장면부터 걷기 ↗</button>`, 패널 폭 전체. 저장된 장면과 같아도 문구는 바꾸지 않는다. 어느 장면이든 들어가면 그 장면이 저장된 장면이 된다(기존 규칙).
4. 이어지는 장면 `nav.neighbor-nav[aria-label="이어지는 장면"]`: CTA 바로 아래에 같은 너비의 버튼 두 개(`grid-template-columns: 1fr 1fr`, 간격 8px, 높이 44px, 모서리 5px, 흰 바탕에 1px 테두리). 왼쪽 "← 이전 장면", 오른쪽 "다음 장면 →". 링크는 `a.neighbor-link[href={detailUrl scene}][data-scene]` 이고, `aria-label` 은 보이는 글 뒤에 대상 장면을 붙인 "이전 장면: 01 흰 토끼를 따라서" 꼴이다. 여정 행과 같은 규칙으로 선택을 바꾼다. 첫 장면의 이전과 마지막 장면의 다음은 흐린 자리 `span.neighbor-link.is-disabled[aria-hidden="true"]` 로 남겨 두 버튼의 폭을 맞춘다. "작품 전체 보기"와 브레드크럼은 없다. 작품이 바로 왼쪽에 있기 때문이다(2026-09-29 사용자 요청으로 패널 맨 아래의 글자 링크에서 이 버튼으로 바꿨다).
패널은 이전·다음 버튼으로 끝난다. 예전의 5번 "이 장면에서 만나는 것들"(배치 목록, 색 칩, 이야기, "장면의 중심" 배지, "가까이 다가가면 움직여요.")은 2026-09-29 사용자 요청으로 코드·CSS·검사와 함께 없앴다. 장면의 모델은 3D 공간에서 만난다. 그래서 패널 내용은 배치가 있든 없든 같다.

패널의 제목 위계: 페이지의 `h1` 은 책 제목 하나이고 패널 제목은 `h2` 다. 여정·저자 소개·책 소개의 `h2` 와 나란하다.

850px 이하의 장면 시트
- 여정 행을 누르면 기존 `modal()` 로 `<dialog class="modal scene-sheet">` 를 열고 그 안에 `scenePanel()` 결과를 넣는다. 시트는 화면 아래에서 올라오는 모양(`position: fixed; inset: auto 0 0 0; max-height: 88dvh; border-radius: 18px 18px 0 0`)이고 안쪽 스크롤을 가지며, 패널처럼 스크롤바는 숨긴다. 닫기 버튼·배경 클릭·Esc 는 `modal()` 의 기존 동작이며 닫히면 초점이 누른 행으로 돌아간다(`modal()` 이 이전 초점을 복원한다).
- 시트 안의 CTA·이전·다음은 패널과 같은 마크업이라 `setupDetail()` 의 위임 처리기(9절)가 `document` 수준에서 함께 받는다. 시트에서 이전·다음을 누르면 시트 내용과 왼쪽 선택이 함께 바뀐다.
- 주소로 `?book=&scene=` 을 열었을 때 시트를 자동으로 열지는 않는다. 선택된 행 강조와 하단 바가 그 장면을 가리킨다.

하단 고정 바 `.detail-cta`(850px 이하)
- `position: sticky; bottom: 0; order: 99`, 배경 `#fff`, 위쪽 1px 경계선, `padding-bottom: env(safe-area-inset-bottom)`. `.store-content` 의 좌우 여백(600px 이하 20px, 370px 이하 14px)을 음수 margin 으로 상쇄해 화면 폭 전체를 쓴다. 왼쪽에 `small.detail-cta-scene` "`02 · 작아지는 문, 커지는 세계`", 오른쪽에 `.primary-button.detail-enter[data-enter][data-enter-chapter]` "이 장면부터 걷기". 장면 선택이 바뀌면 이 바도 다시 그린다. 여정 설명의 두 문구는 `span.journey-hint--wide`(851px 이상)와 `span.journey-hint--narrow`(850px 이하)로 넣고 CSS 로 하나만 보인다.

## 8. 홈 변경(기존 유지)

`client/landing.js` 의 카드 링크 구조는 두 뎁스 구현과 같다. 도서 카드 `a.book-entry[href={detailUrl book}][data-book]`(`aria-label` "{책} — 작품 상세"), 장면 카드 `a.scene-card[href={detailUrl scene}][data-scene-book][data-scene-chapter]`(`aria-label` "{책} · {장면} — 작품 상세"), 히어로 `button[data-feature-book]`(문구 "작품 살펴보기", `aria-label` "{제목} 작품 상세"). `setupCatalog()` 의 `onOpen(target, bookId, sceneId)`, 초점 복원 선택자, 자동 재생 초점 보호도 그대로다. `client/index.html` 설명 메타도 이미 고쳤다.

## 9. main.js 와 detail.js 정리

- `view` 는 `home`·`book`·`world`. 두 뎁스의 `scene` 상태는 없어지고 `book` 상태의 `chapter`(선택 장면)와 `sceneAddressed` 로 흡수된다.
- `resolveView(params)` 는 3절대로 `{ view, book, chapter, sceneAddressed, clean }` 을 돌려준다. `applyResolved()` 가 다섯 값을 적용하고 `clean` 이면 `replaceState` 한다.
- `openDetail(target, bookId, sceneId)`: `target` 이 `"scene"` 이면 그 장면을 선택하고 `sceneAddressed = true`, `"book"` 이면 기본 장면과 `false`. 둘 다 `view = "book"` 으로 커튼 전환하고 `pushState(currentUrl())` 한다.
- `selectScene(sceneId, { sheet = false })`: `chapter` 를 바꾸고 `sceneAddressed = true`, `history.replaceState(null, "", currentUrl())`, `aside.scene-panel` 과 `.detail-cta` 의 내용을 다시 그리고 여정 행의 `aria-current` 를 옮기고 `#scene-status` 문구를 바꾸고 `icons()` 를 부른다. `sheet` 가 참이면(850px 이하의 행 클릭) `modal()` 로 장면 시트를 열어 같은 패널 마크업을 넣는다. 이미 시트가 열려 있으면 그 안의 내용만 바꾼다. 폭 판정은 `matchMedia("(max-width: 850px)").matches` 다.
- `setupDetail()`: `document` 에 클릭 위임 하나를 단다(시트는 `body` 끝에 붙는 `dialog` 라 `main` 안이 아니다). `[data-enter]` → `enterBook(id, chapterId)`; `a.journey-row[data-scene]` → 수정키 클릭이면 그대로, 아니면 `preventDefault()` 뒤 `selectScene(id, { sheet: 폭 판정 })`; `a.neighbor-link[data-scene]` → 같되 시트가 열려 있으면 시트 안에서 바꾼다. `AbortController` 로 해제한다.
- `bookDetail()` 은 페이지 전체를, `scenePanel()` 은 패널 안쪽을 돌려준다. 두 뎁스의 `sceneDetail()` 은 없어지고 그 내용이 `scenePanel()` 로 옮겨 간다. 하단 바 마크업은 `detail.js` 의 `sceneBar({ book, chapter })` 가 만든다.
- `bookDetails()` 모달(3D 월드 안)은 그대로다. CTA 문구 "이야기로 돌아가기".
- `client/detail.css` 는 `main.js` 에서 import 하고, `detail.js` 는 CSS·이미지·`document` 를 쓰지 않는다(Node 단위 검사).

## 10. 파일 구조

```
client/
  main.js          view 셋, resolveView(sceneAddressed), openDetail, selectScene, setupDetail   (수정)
  detail.js        detailUrl(), bookDetail(), scenePanel(), sceneBar(). sceneDetail() 삭제      (수정)
  detail.css       두 열 격자, 화면 높이 고정 패널, 선택 행, 장면 시트, 하단 바                    (수정)
  transitions.js   .detail-page 등장 그룹                                                        (수정)
  landing.js, landing.css, book-meta.js, index.html                                              (변경 없음)
shared/
  schema.js        bookSchema 의 authorIntro·bookIntro(19절)                                     (수정)
tests/
  detail.test.js   bookDetail·scenePanel·sceneBar 단위 검사, 소개 섹션과 스키마(19절)              (수정)
  catalog.mjs      카드 → 상세 → 패널 → CTA → 월드, 장면 선택, 주소, 시트                          (수정)
  mobile-entry.mjs 표지 탭 → 상세 → 하단 바 탭 → 월드                                             (수정)
  home-admin.mjs   소개 칸 입력 → 저장 → 공개 → 작품 상세의 섹션 순서(19절)                        (수정)
  capture.mjs                                                                                    (선택자 확인)
docs/
  screenshots/detail-book-desktop.png(기본 장면), detail-book-mobile.png(하단 바),
              detail-scene-desktop.png(?scene=alice-2 선택), detail-scene-mobile.png(장면 시트 열림) (갱신)
  preview/detail.png                                                                             (갱신)
  ADMIN-GUIDE.md, README.md, superpowers/specs/2026-09-11-react-next-migration-design.md          (수정)
admin/
  main.js          장면 썸네일 도움말 문구 한 줄, 책 정보의 저자 소개·책 소개 칸(19절)               (수정)
```

반응형 분기점은 `landing.css` 와 같은 1100, 850, 600, 370px 이다.

## 11. 문구

| 자리 | 문구 |
| --- | --- |
| 커튼 | 작품을 펼치는 중이에요… |
| CTA | 이 장면부터 걷기 |
| 섹션 제목 | 이 책의 여정 / 저자 소개 / 책 소개 |
| 섹션 설명 | 장면을 고르면 오른쪽에서 그 장면을 먼저 볼 수 있어요.(851px 이상) / 장면을 고르면 그 장면을 먼저 볼 수 있어요.(850px 이하) / 가까이 다가가면 움직여요. |
| 배지 | 마지막에 머문 장면 |
| 상태 문구 | `{번호} {장면 제목}` 장면을 골랐어요 |
| 이미지 자리 | 표지 이미지 준비 중 / 장면 이미지 준비 중 / 썸네일이 있으면 `{장면} 장면 이미지` |
| 패널 eyebrow | 장면 02 / 06 |
| 하단 바 | `02 · 장면 제목` |
| 이전·다음 버튼 | 이전 장면 / 다음 장면(읽는 이름은 "이전 장면: 01 흰 토끼를 따라서") |
| 윗부분 | 홈과 같음(띠 배너, 로고, 검색창 "어떤 이야기를 찾으세요?", 소개, 책장 홈, 이용 방법) |
| 홈 히어로 카드 | 작품 살펴보기 |
| `aria-label` | `{책} — 작품 상세` / `{책} · {장면} — 작품 상세` / `이어지는 장면` / 시트 닫기 "닫기"(기존 `modal()`) |

## 12. 오류 처리

- 잘못된 `book`·`scene`·`chapter` 값은 3절의 규칙으로 가까운 화면에 떨어지고 주소를 고쳐 둔다.
- `progress[book.id].chapter` 가 이제 없는 챕터를 가리키면 저장된 장면이 없는 것으로 보고 첫 장면을 기본 선택한다.
- 공개 도서가 없으면 홈 주소는 기존 "새로운 이야기를 준비하고 있어요." 화면이다. 초안 미리보기에서는 비공개 도서의 상세·월드 주소가 열린다.
- 3D 진입 뒤의 WebGL 실패 처리는 기존 대체 화면 그대로다.
- 앵커를 새 탭으로 열면 `init()` 이 주소를 해석해 같은 선택으로 그린다. `?preview=draft` 는 `detailUrl()` 이 붙여 준다.
- 장면 시트가 열린 채 창 폭이 850px 을 넘으면 시트는 그대로 열려 있고 닫으면 패널이 보인다. 폭을 다시 판정해 시트를 자동으로 닫지는 않는다.

## 13. 접근성과 반응형

- 전환 후 초점은 `h1#detail-title`. 장면 선택 뒤 초점은 누른 요소에 남고 `#scene-status`(`role="status"`, 시각적으로 숨김)가 선택을 알린다.
- 선택된 여정 행은 `aria-current="true"`. 여정 목록은 `ol`, 행 글자는 한 링크라 스크린 리더가 한 덩어리로 읽는다. 칩과 아이콘은 `aria-hidden`.
- 패널은 `aside[aria-labelledby="panel-scene-title"]`, 이어지는 장면은 `nav[aria-label]`. 이미지 자리는 `role="img"` 와 `aria-label`.
- 장면 시트는 `dialog.showModal()` 이라 초점이 안에 갇히고 Esc 로 닫힌다. 닫으면 초점이 누른 행으로 돌아간다.
- 하단 바는 `env(safe-area-inset-bottom)` 을 더하고, 페이지 끝에 바 높이만큼 여백을 두어 책 소개가 가려지지 않게 한다.
- 새 애니메이션은 없다. 등장 순서는 `transitions.js` 가 `prefers-reduced-motion` 을 처리한다. 시트가 올라오는 움직임도 `prefers-reduced-motion: reduce` 에서는 즉시 나타난다.

## 14. 테스트

### 14.1 단위 검사 `tests/detail.test.js`(`npm test` 에 포함)

`client/detail.js` 와 `client/book-meta.js` 를 Node 에서 import 한다. 도서 데이터는 `librarySchema.parse(seed)` 의 앨리스·오즈다.

- `detailUrl`(기존 검사 유지).
- `bookDetail`: 저장 없음이면 여정 1행이 `aria-current="true"` 이고 패널 제목이 1장면, CTA `data-enter-chapter="alice-1"`. 저장(`alice-2`)이면 2행이 선택·배지, 패널이 2장면, 패널 제목 아래 배지. `chapter` 인자로 3장면을 넘기면 3행 선택·패널 3장면(주소로 연 경우). 히어로에 버튼이 없다(`data-enter` 는 패널과 하단 바에만, 합계 2개). 여정 행 `href` 가 `detailUrl` 과 같다. 표지가 있으면 `.detail-cover img` 하나, 없으면 "표지 이미지 준비 중". 제목에 `<` 가 든 가짜 책으로 이스케이프 확인.
- `scenePanel`: 16:10 이미지 자리와 번호, 썸네일이 있으면 `has-image`·`<img>`·`aria-label="{제목} 장면 이미지"`(`"`·`<` 가 든 제목의 이스케이프 포함), 없으면 "장면 이미지 준비 중". `h2#panel-scene-title`. CTA 하나. 모델 묶음·본문·미리 읽기·바닥 글귀 안내는 없고, 이전·다음 버튼이 CTA 바로 뒤에서 패널을 끝낸다. 배치가 있든 없든 패널은 같다. 첫 장면의 이전과 마지막 장면의 다음은 흐린 자리다. `bookDetail` 히어로는 연도·한글 제목·저자만이고 분류·장면 수·영문 제목·소개 문장이 없으며, 저자가 비면 저자 줄이 없다. 저장된 장면이면 배지. 없는 챕터는 예외.
- `sceneBar`: `02 · 작아지는 문, 커지는 세계` 와 `data-enter-chapter="alice-2"`.
- 모든 링크가 `preview: true` 에서 `&preview=draft` 를 유지한다.

### 14.2 브라우저 검사 `tests/catalog.mjs`(4336 포트)

1. 검색·분류·정렬 단계(기존) 뒤: `[data-book="alice"]` 클릭 → `.detail-page[data-view="book"]`, `#detail-title` "이상한 나라의 앨리스", 초점 `#detail-title`, 주소 `?book=alice`, `.journey-row` 6개 중 `[aria-current="true"]` 가 `alice-1`, `.scene-panel #panel-scene-title` "흰 토끼를 따라서", 상세 안 `img` 0개(시드). 여정 2행 클릭 → 커튼 없음(`.reader-curtain` 0), 주소 `?book=alice&scene=alice-2`, `history.length` 변화 없음(클릭 전후 `page.evaluate(() => history.length)` 비교), 패널 제목 "작아지는 문, 커지는 세계", `aria-current` 가 2행으로, `#scene-status` 에 "02". 패널의 "다음 장면" 버튼 클릭 → 3장면, 주소 `scene=alice-3`. 여정 1행 클릭 → 1장면, 주소 `scene=alice-1`. 패널 CTA 클릭 → `#world canvas`, 주소 `book=alice&chapter=alice-1`. 이어서 기존 "작품 소개" 모달 검사와 3D 안 이동·다음 챕터(02) 검사가 그대로 이어진다.
2. 3D 안 이동·챕터 이동(기존). "책장으로" → `.catalog-card` 2개(기존).
3. "읽던 작품 이어 보기" → `[data-book="alice"]` 클릭 → 저장된 2장면 행이 선택·배지, 패널 제목 "작아지는 문, 커지는 세계"와 배지 "마지막에 머문 장면", 주소는 `?book=alice`(기본 선택이라 `scene` 없음). CTA 클릭 → `#map-button` 에 "02". `reload` 뒤에도 "02".
4. `goBack()` → 작품 상세(선택 유지, 주소에 `scene`), 한 번 더 → `.library-page`, `goForward()` 두 번 → 월드.
5. 홈에서 `[data-scene-chapter="alice-3"]` 클릭 → `.detail-page[data-view="book"]`, 주소 `?book=alice&scene=alice-3`, 3행 선택, 패널 제목 "버섯 숲의 수수께끼", 본문 문단·모델 묶음 없음, 패널의 마지막 요소는 이전·다음 버튼, "이전 장면"은 `alice-2`, "다음 장면"은 `alice-4`. 두 버튼은 CTA 바로 아래 한 줄에 같은 폭이고 합친 폭이 CTA 와 같다. CTA → 월드 `chapter=alice-3`.
6. 홈에서 `.feature-card.is-active`(앨리스) 클릭 → 작품 상세. 로고 → `.feature-card.is-active` 에 초점, 5.6초 뒤에도 유지(기존. 작품 상세에 "책장으로"가 없어져 로고를 누른다).
7. 주소 직접 열기(기존 7단계에 더해): `?book=alice&scene=alice-2` 는 2행 선택과 패널 2장면, 문서 제목은 책 제목. 나머지(`?book=nope`, `?scene=alice-2`, `?book=alice&chapter=nope`, `?book=alice&scene=nope&preview=draft`, 초안 미리보기의 빈 책장)는 기존 단정 유지.
8. 홈 화면 관리 묶음("Studio covers…" 단계, 가로챈 응답): `[data-book="alice"]` → `.detail-cover img` 1개; 썸네일이 있는 장면 카드 → 패널 `.scene-panel .scene-image.has-image img` 1개, 그 자리의 폭/높이 비 1.6(±0.02).
9. 휴대폰 반복(320·390·768): 카드 탭 → 상세, `aside.scene-panel` 은 보이지 않고 `.detail-cta` 가 화면 아래에 있으며 폭 전체(`left 0`, `right = innerWidth`). 여정 2행 탭 → `dialog.scene-sheet[open]` 안에 `#sheet-scene-title` "작아지는 문, 커지는 세계", 하단 바 문구 "02 ·". 시트 안 이전·다음 링크는 시트·여정 선택·하단 바를 함께 바꾸고, 시트 안 CTA 탭 → `#world canvas`, 주소 `chapter=<그 장면>`. 768px 도 한 열이므로 같은 흐름이다.
10. 작품 상세의 윗부분은 홈과 같은 띠 배너·로고·검색창·소개·책장 홈·이용 방법이고 `reader-header`·푸터가 없다. 18장면 픽스처(1440·1024)에서 맨 위·가운데(400px)·끝까지 스크롤해도 `.detail-top` 은 위 0 에 붙어 있고, 패널은 그 바로 아래(`--detail-top` 이 잰 높이와 같음)부터 화면 아래 끝까지 채우며 왼쪽 1px 선 외에는 테두리·모서리가 없다. 오른쪽 끝이 콘텐츠 상자에 맞고 왼쪽 열과의 간격이 48px·32px 이다. 스튜디오 썸네일은 패널의 내용 폭 전체를 채운다.
11. 작품 상세 검색창에 "오즈" 입력 뒤 Enter → 책장, "검색 결과" 1권, 검색창에 "오즈"가 남고 초점이 있으며 `tabindex` 가 붙지 않는다. 띠 배너 → 책장의 `#scene-title` 에 초점이 있고 화면 안에 보인다.

### 14.3 `tests/mobile-entry.mjs`(4321 포트)

`[data-book="alice"] .cover-stage` 탭 → `.detail-page[data-view="book"]` → 커튼 없음 → 스크롤 없이 보이는 `.detail-cta .primary-button` 을 `tapVisible` 로 탭 → 월드. 그 뒤 단정은 기존과 같다.

### 14.4 `tests/home-admin.mjs`, `tests/capture.mjs`

`home-admin.mjs` 는 홈 카드 선택자(`[data-book]`)만 쓰므로 그대로 통과해야 한다. `capture.mjs` 는 `[data-book="alice"]` 클릭 뒤 `.detail-page` 를 `docs/preview/detail.png` 로 찍고(마우스는 빈 왼쪽 여백 `(0, 400)` 으로 옮긴 뒤. `(0, 0)` 은 이제 띠 배너 위라 hover 모양으로 찍힌다), 패널 CTA `.scene-panel .detail-enter` 을 눌러 `explore.png` 를 찍는다.

### 14.5 회귀

`npm test`, `npm run build`, `node tests/catalog.mjs`, `node tests/mobile-entry.mjs`, `node tests/home-admin.mjs`, `npm run test:about`(마지막 항목은 워크트리에서만 실패하는 기존 vite 경로 문제)을 통과해야 한다. `browser.mjs`, `floor-reading.mjs`, `collision.mjs`, `admin-parity.mjs`, `floor-editor.mjs` 는 `?book&chapter` 주소로 바로 들어가므로 영향받지 않는다.

스크린샷은 1440×960 과 390×844 에서 10절의 네 파일로 다시 찍는다. 장면 시트 화면은 390×844 에서 여정 2행을 누른 뒤 찍는다. 휴대폰 전체 페이지(`detail-book-mobile.png`)는 화면 높이를 문서 높이로 늘려 찍는다. 844px 화면 그대로 전체 페이지를 찍으면 하단 고정 바가 페이지 중간에 찍혀 글을 가리기 때문이다.

## 15. 문서 반영

- `README.md`: "장면을 누르면 … 장면 상세 페이지가 열립니다" 문장을 "장면을 누르면 그 장면이 선택된 작품 상세가 열립니다"로, 작품 상세 설명에 "오른쪽 패널에서 장면을 고르고 '이 장면부터 걷기'로 3D 공간에 들어갑니다. 휴대폰에서는 장면을 누르면 아래에서 시트가 올라옵니다"를 더한다. 주소 문장은 `?book=<책>&scene=<장면>` 이 "그 장면이 선택된 작품 상세"라고 고친다. 확인 순서 1 은 "표지를 눌러 작품 상세를 열고 '이 장면부터 걷기'를 누른 뒤".
- `docs/ADMIN-GUIDE.md`: "장면 상세 페이지에서도 썸네일은 16:10 비율 그대로 보입니다." → "작품 상세의 장면 패널에서도 썸네일은 16:10 비율 그대로 보입니다."
- `admin/main.js` 챕터 편집 창의 장면 썸네일 도움말: "사용자 화면의 장면 목록에 16:10 비율로 보여요(예: 1280×800). 없으면 빈 자리로 둡니다." → "사용자 화면의 장면 목록과 작품 상세의 장면 패널에 16:10 비율로 보여요(예: 1280×800). 없으면 빈 자리로 둡니다." 관리자 쪽 변경은 이 문구 한 줄뿐이다. 스튜디오의 "공개된 탐험 화면 보기" 링크와 "독자 화면으로 체험" 미리보기는 `?book=&chapter=`(3D 월드)나 `?preview=draft`(홈)를 열므로 영향이 없고, 홈 미리보기 iframe 안에서 카드를 누르면 이제 iframe 안에서 작품 상세가 열린다(실제 독자 흐름과 같다).
- 전환 스펙 10절: 화면 상태를 셋(`/`, `?book=<id>`(선택 장면은 `&scene=`), `?book=&chapter=`)으로 고치고 이 설계 파일을 가리킨다.
- `docs/PRD.md` 의 슬라이드 문장은 그대로 맞다.

## 16. 위험과 대응

- 패널이 화면보다 길면(낮은 화면) 패널 안쪽 스크롤이 생긴다. CTA 를 이미지·제목 바로 아래(3번째)에 두어 스크롤 없이 보이게 한다.
- 장면 선택이 히스토리에 남지 않으므로 "뒤로가기로 직전 장면"은 되지 않는다. 대신 이전·다음 버튼과 여정 목록이 항상 보인다. 이 절충은 1안의 결정 사항이다.
- `document` 수준 클릭 위임은 3D 월드 화면에는 없어야 한다. `setupDetail()` 의 해제 함수를 `disposeView` 로 두어 다른 화면으로 갈 때 반드시 해제한다.
- 850px 경계에서 패널과 시트 어느 쪽에도 CTA 가 보이지 않는 순간이 없어야 한다. `aside` 와 `.detail-cta` 의 `display` 를 같은 분기점 850px 로 묶는다.
- 두 뎁스 검사(`catalog.mjs` 의 장면 상세 블록, `detail.test.js` 의 `sceneDetail` 검사)가 대부분 바뀐다. 실패 지점을 알 수 있게 단계마다 `pass()` 를 둔다.

## 17. 완료 기준

- 홈의 도서 카드·장면 카드·추천 히어로 카드·읽던 이야기 카드가 모두 작품 상세 한 페이지로 이동하고, 장면 카드는 그 장면이 선택된 채 열린다. 홈에서 3D 월드로 바로 들어가는 경로가 없다.
- 851px 이상에서 오른쪽 패널이 스크롤을 따라다니며 항상 장면 하나와 CTA "이 장면부터 걷기"를 보인다. 여정 행을 누르면 페이지 이동·커튼 없이 패널만 바뀌고 주소에 `&scene=` 이 반영된다.
- 850px 이하에서 여정 행을 누르면 장면 시트가 열리고, 화면 아래 고정 바가 선택된 장면으로 들어간다.
- `?book=alice` 와 `?book=alice&scene=alice-2` 를 새로고침·새 탭·뒤로가기로 열어도 같은 선택 상태가 나온다. `?book=alice&chapter=alice-1` 은 지금처럼 3D 월드다.
- 등록된 표지·장면 썸네일은 보이고, 없는 칸은 비어 있으며 장면 자리는 항상 16:10 에 테마 색만 다르다.
- 3D 월드 안의 작품 소개 모달과 이야기의 지도는 이전과 같이 동작한다.
- 14.5 의 검사가 통과하고 스크린샷 네 장이 갱신되어 있다. README, ADMIN-GUIDE, 전환 스펙 10절이 갱신되어 있다.

## 18. 두 뎁스 구현에서 바뀌는 점(구현 계획의 범위)

| 두 뎁스(현재 브랜치) | 두 열(이 설계) |
| --- | --- |
| `view` 넷(`home`·`book`·`scene`·`world`) | 셋. `scene` 은 `book` 의 선택 장면 + `sceneAddressed` |
| 장면 상세 페이지 `sceneDetail()` | 없음. 패널 `scenePanel()` 과 하단 바 `sceneBar()` |
| 여정 행 클릭 → 커튼 → 장면 페이지 `pushState` | 패널 교체, `replaceState`, 커튼 없음 |
| 작품 상세 CTA "이야기 속으로 들어가기"·"이어 읽기"·"처음부터 시작하기" | 없음. 패널 CTA "이 장면부터 걷기" 하나, 기본 선택이 저장된 장면 |
| 브레드크럼·"작품 전체 보기" | 없음 |
| 장면 히어로 가로 띠(썸네일 있으면 16:10 최대 768px) | 패널 폭의 16:10 항상 |
| 커튼 문구 둘 | "작품을 펼치는 중이에요…" 하나 |
| `document.title` 에 장면 제목 | 책 제목만 |
| 휴대폰: 한 열 페이지 + 하단 고정 CTA | 한 열 + 장면 시트 + 하단 고정 바(장면 이름 포함) |
| `.detail-page[data-view="scene"]` 선택자를 쓰는 검사 | `data-view="book"` 과 패널·시트 선택자로 교체 |

바뀌지 않는 것: 홈 카드 링크와 `landing.js`, `book-meta.js`, `detailUrl()`, `resolveView()` 의 우선순위 골격, 커튼 전환 체계, 표지·썸네일 표시 규칙, 서버·스키마·관리자. 스키마와 관리자는 그 뒤 19절에서 소개 필드 두 개가 늘었다.

## 19. 저자 소개·책 소개(2026-09-29 추가)

사용자 요청으로 '이 책의 여정'을 한 섹션으로 두고, 그다음 섹션에 저자 소개와 책 소개를 넣는다. 두 글은 관리자에서 입력한다.

데이터
- `bookSchema` 에 `authorIntro`(저자 소개)와 `bookIntro`(책 소개)를 더한다. 둘 다 `z.string().max(5000).default("")` 라서 예전 데이터와 시드도 그대로 통과한다.
- 저장된 공개본은 다시 파싱하지 않으므로(`server/publication.js`) 두 필드가 없는 책이 올 수 있다. 화면은 없는 값을 빈 글로 다룬다.
- 서버 코드는 바꾸지 않는다. `PUT /api/studio` 가 스키마로 파싱해 두 필드를 보존하고, 공개본은 책 객체를 통째로 싣는다.

작품 상세
- 왼쪽 열 순서는 히어로 → 이 책의 여정 → 저자 소개 → 책 소개이고, 책 소개가 왼쪽 열의 끝이다(원작 정보 섹션은 6절대로 없앴다). 사용자가 말한 순서대로 저자 소개가 먼저다.
- 마크업: `<section class="detail-section detail-intro" id="detail-author" aria-labelledby="detail-author-title">` 안에 `div.section-heading > h2#detail-author-title` "저자 소개", 저자 이름이 있으면 `p.detail-intro-name`, 그리고 `div.detail-prose` 의 문단 `p` 들. 책 소개는 `id="detail-book-intro"`, 제목 "책 소개"이고 이름 줄이 없다.
- 빈 줄로 문단을 나눈다(장면 본문과 같은 `paragraphsOf()`). 문단 안의 한 줄 바꿈은 `white-space: pre-line` 으로 화면에 남긴다.
- 비었거나 공백뿐인 필드도 섹션은 그대로 두고, `div.detail-prose` 대신 `p.detail-intro-empty` 에 "저자 소개를 준비 중이에요." 또는 "책 소개를 준비 중이에요."를 보인다. 글자 15px(600px 이하 14px), 줄 간격 1.7, 색 `#7f8982`. 저자 이름은 소개가 비어 있어도 있으면 보이고, 이름이 비어 있으면 이름 줄만 뺀다.
- 글은 모두 `esc()` 로 이스케이프한다. HTML 은 쓸 수 없다.
- 모양: 섹션 제목은 여정과 같은 `.section-heading`. 본문 16px, 줄 간격 1.8(600px 이하 15px, 1.75), 색 `#3f4a44`, 최대 폭 680px. 이름 줄 17px, 굵기 650(600px 이하 16px).
- 등장 효과에서 `.detail-intro` 는 여정과 같은 단계다(5절).

관리자
- 책 정보 창의 '소개 문장' 아래에 '저자 소개'(5줄)와 '책 소개'(6줄) `textarea` 를 둔다. 둘 다 `maxlength="5000"` 이고 새 책은 빈 값으로 시작한다.
- 도움말: "소개 문장은 작품 상세 맨 위에 보이는 짧은 글이고, 저자 소개와 책 소개는 ‘이 책의 여정’ 아래에 차례로 보여요. 빈 줄로 문단을 나누고, 비워 두면 ‘준비 중’ 문구가 보여요."
- 두 칸은 공개 조건이 아니다. 공개에 필요한 것은 기존대로 저자와 권리 정보다.

검사
- `tests/detail.test.js`: 섹션 마크업과 순서(여정 < 저자 소개 < 책 소개, 책 소개 뒤에 왼쪽 열이 닫힘), 원작 정보 없음, 문단 나눔과 줄 바꿈 보존, 이스케이프, 글이 있으면 준비 중 문구 없음, 비었거나 없는 필드의 준비 중 문구(이름 줄은 유지), 이름 없는 저자 소개, 스키마 기본값과 5000자 제한.
- `tests/home-admin.mjs`: 책 정보 창에서 두 칸을 채워 저장하면 초안에 남는다. 공개 뒤 `?book=alice` 에서 `#detail-author`·`#detail-book-intro` 가 여정 다음에 있고 책 소개가 왼쪽 열의 마지막이며(`.detail-source` 없음), 문단 안 줄 바꿈이 화면에 남는다(`innerText`). 두 칸을 비운 채 공개된 `?book=oz` 에는 작가 이름과 두 준비 중 문구가 보인다.
- 문서 스크린샷(14.5)은 시드에 소개가 없으므로 두 섹션이 준비 중 문구로 찍힌다.

문서
- README 의 작품 상세 문장, `docs/ADMIN-GUIDE.md` 의 도서 정보 문장, `docs/PRD.md` A-01 에 두 칸을 더한다.

저장소 전환과의 관계
- Supabase 저장소 브랜치(`claude/supabase-storage`)의 `server/rows.js` 는 책 필드를 표의 열 단위로 옮긴다. 그 브랜치와 합칠 때 `books` 표에 두 열(`author_intro`, `book_intro`)을 더하는 이전 SQL 과 `rows.js` 대응표 두 줄이 필요하다. 빠뜨리면 저장할 때 두 필드가 조용히 사라진다.
