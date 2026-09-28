# On the Book: 작품 상세·장면 상세 페이지 설계

작성일 2026-09-28. 사용자 화면(client) 홈의 "지금 만나볼 이야기"와 "한 장면부터 시작하는 여행" 카드가 3D 월드로 바로 들어가는 대신 상세 페이지를 거치고, 상세 페이지의 CTA 로만 3D 월드에 진입하도록 바꾸는 설계다.

## 1. 배경과 목표

현재 `client/main.js` 는 `exploring` 참·거짓 하나로 책장 홈과 3D 월드 두 화면을 오간다. 홈의 도서 카드(`[data-enter]`), 장면 카드(`[data-scene-book]`), 추천 히어로 카드(`[data-feature-book]`)는 모두 `enterBook()` 을 바로 불러 3D 월드로 들어간다. 작품 정보는 3D 월드 안의 "작품 소개" 모달(`bookDetails()`)에서만 볼 수 있고, 홈에서는 볼 수 없다.

사용자가 정한 방향은 다음과 같다.

- 도서 카드는 **작품 상세**로, 장면 카드는 **장면 상세**로 이동한다. 두 페이지의 CTA 가 3D 월드 진입의 유일한 입구다.
- 구조는 A 안이다. 기존 SPA(`client/main.js`) 안에 화면 상태를 추가하고 주소는 쿼리로 구분한다. 별도 진입점이나 경로형 주소는 쓰지 않는다.
- 표지와 장면 이미지는 처음에 홈과 같이 자리만 비워 두기로 했다. 2026-09-28 main 의 홈 화면 관리(PR #2)로 책장이 관리자가 올린 표지(`book.cover`)와 장면 썸네일(`chapter.thumbnail`)을 보여 주게 되어, 상세 페이지도 **등록된 표지와 장면 썸네일을 보여 주고** 등록되지 않은 칸은 이름표(`aria-label`)가 달린 빈 자리로 둔다. 모델 썸네일은 표시하지 않는다.

기준 스택은 현재 client(Vite 멀티 페이지 + 바닐라 JS + npm `three` 0.180)다. React·Next 전환은 전환 스펙 6단계에서 하며, 이 설계의 주소 규칙과 화면 구성을 그때 그대로 옮긴다.

## 2. 범위와 비범위

범위
- 작품 상세(`?book=`)와 장면 상세(`?book=&scene=`) 두 화면. 공통 셸(헤더·CTA·원작 정보·푸터)과 각자의 본문 섹션.
- 홈 카드 연결. 도서 카드, 장면 카드, 추천 히어로 카드, "읽던 이야기" 분류의 도서 카드(같은 `bookCard`)가 모두 상세로 이동한다. 직행 경로는 남기지 않는다.
- 주소 해석, 브라우저 히스토리, 커튼 전환, 초점 이동, 책장 위치 복원.
- 검사(`tests/catalog.mjs`, `tests/mobile-entry.mjs`, `tests/capture.mjs`, 새 단위 검사), README, `index.html` 설명 문구, 전환 스펙 10절.

비범위
- 서버, `shared/schema.js`, 관리자 화면, `client/vercel.json`, `server/index.js` 변경. 상세 페이지가 쓰는 정보는 모두 `/api/library` 응답에 이미 있다.
- 라이브 3D 미리보기(`World` 의 `hero` 모드)는 넣지 않는다. 카드마다 캔버스를 띄우면 진입이 느려지고 CTA 의 "본격 진입" 의미가 약해진다.
- 3D 월드 안의 "작품 소개" 모달과 "이야기의 지도" 모달의 내용·동작 변경. 모달은 탐험을 끊지 않기 위해 그대로 둔다.
- 새 저장 데이터. 방문한 장면 기록 같은 것을 추가하지 않고 기존 `otb-reader` 의 `{ [bookId]: { chapter } }` 만 읽는다.
- 홈의 검색·분류·정렬·빠른 메뉴·트레일러·이용 가이드 변경. 소개 페이지(`/about`) 변경.
- 경로형 주소(`/books/alice`). Next App Router 로 옮길 때 다시 정한다.

## 3. 화면 상태와 주소

`main.js` 의 `exploring` 참·거짓을 문자열 `view` 로 바꾼다. 값은 `home`, `book`, `scene`, `world` 넷이다. 기존 코드에서 `exploring` 이 참이던 곳은 모두 `view === "world"` 에 해당한다.

| view | 주소 | 화면 | 전환 후 초점 |
| --- | --- | --- | --- |
| `home` | `/client/` | 책장 홈(기존) | `#library-title`(기존) |
| `book` | `/client/?book=alice` | 작품 상세 | `#detail-title` |
| `scene` | `/client/?book=alice&scene=alice-2` | 장면 상세 | `#detail-title` |
| `world` | `/client/?book=alice&chapter=alice-1` | 3D 월드(기존) | `#world canvas`(기존) |

주소 해석은 `init()` 과 `popstate` 가 같은 함수 `resolveView(params)` 를 쓴다. 우선순위는 다음과 같다.

1. `book` 이 공개 도서에 없으면 `home`. 주소는 `history.replaceState` 로 `preview` 만 남기고 지운다. 초안 미리보기(`?preview=draft`)에서는 비공개 도서도 `library.books` 에 있으므로 그 상세와 월드 주소가 열리고, 홈 책장에만 공개 도서가 보인다.
2. `chapter` 가 그 책의 챕터면 `world`.
3. 아니면 `scene` 이 그 책의 챕터면 `scene`.
4. 아니면 `book`. `scene` 이나 `chapter` 가 잘못된 값이면 주소를 `?book=` 으로 고쳐 둔다.

현재는 `?book=alice` 만 있으면 홈이 열리고, `chapter` 가 잘못되면 홈으로 떨어진다. 이 설계에서는 둘 다 작품 상세가 열린다. 안내 문구는 띄우지 않는다. 지금도 잘못된 `chapter` 를 조용히 홈으로 보내기 때문이다.

주소 생성은 `client/detail.js` 의 순수 함수 `detailUrl({ book, scene, chapter, preview })` 한 곳에서 한다. `?preview=draft` 는 기존 `readerUrl()` 처럼 모든 주소에 이어 붙인다. `main.js` 는 앞에 `location.pathname` 을 붙여 쓴다. 로컬 서버의 `/` 는 302 로 `/client/` 에 보내며 쿼리를 버리므로, 로컬에서 공유하는 주소는 `/client/?book=` 형태다. Vercel 은 `/` 를 rewrite 하므로 쿼리가 유지된다. 지금의 `?book&chapter` 와 같은 조건이다.

문서 제목은 `render()` 에서 화면마다 바꾼다.

| view | `document.title` |
| --- | --- |
| `home`, `world` | `On the Book — 책 속을 걷는 시간`(기존) |
| `book` | `이상한 나라의 앨리스 — On the Book` |
| `scene` | `작아지는 문, 커지는 세계 · 이상한 나라의 앨리스 — On the Book` |

## 4. 이동 흐름

모든 화면 변경은 기존 `transitionPage(app, update, { label })` 커튼을 거친다. 커튼은 `inert`·`aria-busy`·초점 이동·등장 순서를 함께 처리하므로 상세끼리 이동할 때도 같은 길을 쓴다. 3D 월드 안의 챕터 이동도 이미 커튼을 쓰고 있어 제품 전체의 리듬이 같아진다.

| 출발 | 조작 | 도착 | 히스토리 | 커튼 문구 |
| --- | --- | --- | --- | --- |
| 홈 | 도서 카드, 히어로 카드, 읽던 이야기 카드 | 작품 상세 | `pushState` | 작품을 펼치는 중이에요… |
| 홈 | 장면 카드 | 장면 상세 | `pushState` | 장면을 펼치는 중이에요… |
| 작품 상세 | 여정 목록의 장면 행 | 장면 상세 | `pushState` | 장면을 펼치는 중이에요… |
| 장면 상세 | 브레드크럼의 책 제목, "작품 전체 보기" | 작품 상세 | `pushState` | 작품을 펼치는 중이에요… |
| 장면 상세 | 이전·다음 장면 | 이웃 장면 상세 | `pushState` | 장면을 펼치는 중이에요… |
| 작품 상세 | 주 CTA | 3D 월드. 저장된 장면이 있으면 그 장면, 없으면 첫 장면 | `pushState`(기존 `enterBook(id)`) | 이야기 속으로 들어가는 중이에요…(기존) |
| 작품 상세 | 보조 CTA "처음부터 시작하기" | 3D 월드 첫 장면 | `pushState`(`enterBook(id, chapters[0].id)`) | 기존 |
| 장면 상세 | CTA "이 장면부터 걷기" | 3D 월드 그 장면 | `pushState`(`enterBook(id, sceneId)`) | 기존 |
| 작품·장면 상세 | 헤더 "책장으로", 로고 | 홈. 책장 스크롤 위치와 카드 초점 복원 | `pushState` | 책장으로 돌아가는 중이에요…(기존) |
| 3D 월드 | "책장으로" | 홈(기존 그대로) | `pushState` | 기존 |
| 어디서든 | 브라우저 뒤로·앞으로 | 주소가 가리키는 화면 | `popstate` | 문구 없음(기존) |

홈에서 상세로 갈 때 `catalogState.scroll` 에 스크롤 위치를, `catalogState.selected` 에 누른 카드의 CSS 선택자(`[data-book="alice"]`, `[data-scene-chapter="alice-2"]`, `[data-feature-book="alice"]`)를 저장한다. `restoreCatalogPosition()` 은 그 선택자로 초점을 되돌린다. 지금은 도서 id 만 저장하고 `[data-enter=…]` 를 찾는다.

3D 월드에서 뒤로가기를 누르면 상세 페이지로 돌아온다. 상세가 히스토리에 한 칸 더 들어가기 때문이다. 3D 월드의 "책장으로" 버튼은 지금처럼 홈으로 간다. `openLibrary()` 의 분기 조건 `!exploring` 은 `view === "home"` 으로 바꾸고, 상세에서 부르면 3D 월드에서 부를 때와 같은 커튼 경로로 홈에 돌아가 위치를 복원한다.

`popstate` 핸들러는 열린 `dialog` 를 닫고 `resolveView()` 결과로 다시 그린다. 홈으로 돌아온 경우에만 `restoreCatalogPosition()` 을 부른다(기존).

## 5. 공통 셸

`header()` 는 view 에 따라 두 모양이 된다.

| view | 검색창 | 책장 버튼 | 소리 버튼 | 소개 링크 | 이용 방법 |
| --- | --- | --- | --- | --- | --- |
| `home` | 있음 | 아이콘 버튼 "책장 홈"(기존) | 없음 | 조건 동일(기존 `aboutLink`) | 있음 |
| `book`, `scene` | 없음 | 글자 버튼 "책장으로"(`reader-header` 모양) | 없음 | 조건 동일 | 있음 |
| `world` | 없음 | 글자 버튼 "책장으로"(기존) | 있음(기존) | 조건 동일 | 있음 |

- 상단 안내 리본(`announcementBanner()`)은 홈에만 둔다(기존).
- 푸터 문구는 `home`, `book`, `scene` 이 "오래된 이야기, 새로운 발견.", `world` 가 "문장 너머의 세계를, 천천히."(기존)다.
- 상세 페이지의 뼈대는 `<main class="detail-page store-content" id="main-content" data-view="book|scene">` 이다. `.store-content` 를 함께 써서 홈과 같은 1280px 폭과 좌우 여백을 쓴다. `main` 은 `display: flex; flex-direction: column` 이며 직계 자식은 순서대로 `.detail-crumbs`(장면 상세만), `.detail-hero`, `.detail-cta`, `.detail-section`(0개 이상), `.detail-source` 다.
- 등장 순서: `transitions.js` 의 `reveal()` 에 `.detail-page` 가 있을 때의 그룹 `[".site-header", ".detail-crumbs, .detail-hero", ".detail-cta", ".detail-section, .detail-source", ".site-footer"]` 를 추가한다.
- 전환 후 초점: `transitionPage()` 의 기본 초점 대상을 `#library-title` → `#detail-title` → `#world canvas, #fallback-read` 순으로 찾도록 늘린다. `focus` 옵션은 넘기지 않는다. 그래야 기존 규칙대로 화면 맨 위로 스크롤한 뒤 제목에 초점이 간다. `#detail-title` 은 `tabindex="-1"` 인 `h1` 이다.
- CTA 블록 `.detail-cta` 는 페이지에 하나만 둔다. 데스크톱에서는 히어로 바로 아래 흐름에 놓는다. 작품 상세에서는 왼쪽 여백을 히어로의 글 열(표지 180px + 간격 30px)에 맞추고, 히어로가 세로로 쌓이는 장면 상세에서는 왼쪽에 맞춘다. 600px 이하에서는 `order: 99; position: sticky; bottom: 0` 으로 `main` 의 마지막에 내려가 화면 아래에 고정된다. 배경은 페이지 배경과 같은 `#fff`, 위쪽 1px 경계선, `padding-bottom: env(safe-area-inset-bottom)` 을 더한다. 문서 순서는 히어로 → CTA → 본문 그대로라 키보드 순서도 자연스럽다. 버튼을 두 번 만들지 않는다.

## 6. 작품 상세

`client/detail.js` 의 `bookDetail({ book, progress, preview })` 가 마크업 문자열을 돌려준다.

히어로 `.detail-hero`
- 왼쪽: `bookCover(book)` 자리(`.catalog-cover.image-placeholder`, 2:2.85). 표지(`book.cover`)가 등록되어 있으면 그 `<img>`(`alt=""`)가 자리를 채우고, 없으면 `role="img" aria-label="표지 이미지 준비 중"` 인 빈 자리다. 데스크톱 180px, 600px 이하 112px, 370px 이하에서는 위로 올라가 가운데 130px.
- 오른쪽: `.eyebrow` "`{분류} · {장면 수}개의 장면 · {출간연도}`"(분류는 `edition(book).category`), `h1#detail-title` 제목, `p` "`{영문 제목} · {저자}`", `p.detail-description` 소개(`book.description`).

CTA `.detail-cta`
- 저장된 장면(`progress[book.id]?.chapter` 가 이 책의 챕터일 때)이 없으면 주 버튼 하나: `.primary-button` "이야기 속으로 들어가기" + `arrow-up-right` 아이콘. 누르면 `enterBook(book.id)`.
- 저장된 장면이 있으면 주 버튼은 두 줄이다. `<strong>이어 읽기</strong><small>02 · 작아지는 문, 커지는 세계</small>`. 누르면 `enterBook(book.id)`(기존 규칙으로 저장된 장면에서 시작). 옆에 보조 글자 버튼 "처음부터 시작하기"(`.text-button`)를 두고 `enterBook(book.id, book.chapters[0].id)` 를 부른다.
- 주 버튼은 `<button class="primary-button" data-enter="alice">` 이고 `setupDetail()` 이 `enterBook("alice")` 를 부른다. 보조 버튼은 `data-enter-chapter="alice-1"` 을 더해 `enterBook("alice", "alice-1")` 을 부른다. 장면 상세의 CTA 도 같은 방식으로 `data-enter-chapter` 를 쓴다.

여정 `.detail-section#detail-journey`
- `h2` "이 책의 여정", 설명 `p` "장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요."
- `<ol class="journey-list">` 안에 챕터 순서대로 `<li><a class="journey-row" href="{detailUrl scene}" data-scene-book data-scene-chapter>`. 행 안의 순서: 테마 칩 `.theme-chip[data-theme]`(`aria-hidden`), 번호 `01`, `strong` 제목, `small` 부제, 대표 모델 `span.journey-model` "· 조끼 입은 흰 토끼", 배지, `chevron-right` 아이콘.
- 대표 모델은 `chapter.mainPlacementId` 가 가리키는 배치의 `title` 이다. 없으면 첫 배치, 배치가 없으면 생략한다.
- 배지 `.journey-badge` "마지막에 머문 장면"은 `progress[book.id]?.chapter === chapter.id` 인 행 하나에만 붙는다.
- 테마 칩 색은 `shared/world.js` 의 테마 `ground` 색을 CSS 로 옮긴 것이다. meadow `#cad7aa`, night `#929aaf`, tea `#d7c9b6`, rose `#d8c6b7`, gold `#dcca98`. 3D 월드 바닥과 같은 색이라 장면의 분위기를 미리 알려 준다.

원작 정보 `.detail-source`
- `h2` "원작 정보", `p.source-note` 에 `book.rights`, 줄 바꿈, `<a href="{book.source}" target="_blank" rel="noopener noreferrer">원작 정보 보기 ↗</a>`. 3D 월드 안 모달의 것과 같은 마크업이다.

## 7. 장면 상세

`sceneDetail({ book, chapter, library, preview })` 가 마크업을 돌려준다. `chapter` 가 `book.chapters` 에 없으면 예외를 던진다.

브레드크럼 `.detail-crumbs`
- `<nav aria-label="현재 위치">`: `<a href="{detailUrl book}" data-book>이상한 나라의 앨리스</a>` › `<span aria-current="page">장면 02</span>`. 책장 항목은 두지 않는다. 헤더의 "책장으로"가 그 역할이다.

히어로 `.detail-hero.detail-hero--scene`
- 위: `.scene-image.image-placeholder[data-theme]`(가로 전체, 높이 `clamp(180px, 26vw, 340px)`; 등록된 썸네일은 `object-fit: cover` 로 가운데가 보이도록 채운다). 배경은 테마 칩 색이고 홈 장면 카드처럼 왼쪽 아래에 `.scene-number` "02" 를 둔다. 홈 카드에서 눌러 온 그림이 이어지는 느낌을 준다.
- 장면 썸네일(`chapter.thumbnail`)이 등록되어 있으면 `.has-image` 를 더하고 그 `<img>`(`alt=""`)가 자리를 채운다. 테마 색은 사진 뒤에 남고, `.scene-number` 는 홈 카드와 같은 밝은 알약 모양이라 사진 위에서도 읽힌다. 이름표는 `aria-label="{장면 제목} 장면 이미지"`(예: "작아지는 문, 커지는 세계 장면 이미지")다. 썸네일이 없으면 `aria-label="장면 이미지 준비 중"` 인 빈 자리다.
- 아래: `.eyebrow` "`장면 02 / 06 · 이상한 나라의 앨리스`", `h1#detail-title` 장면 제목, `p` 부제(`chapter.subtitle`, 비어 있으면 생략).

CTA `.detail-cta`
- 주 버튼 하나: `.primary-button[data-enter="alice"][data-enter-chapter="alice-2"]` "이 장면부터 걷기" + `arrow-up-right`. 저장된 장면과 같아도 문구는 바꾸지 않는다. 어느 장면이든 들어가면 그 장면이 저장된 장면이 된다(기존 규칙).

미리 읽기 `.detail-section#detail-preview`
- `chapter.body` 를 `\n\n` 으로 나눈 첫 문단만 `p.reading-text` 로 보여 준다. 본문이 비어 있으면 섹션을 만들지 않는다. `floorText` 는 쓰지 않는다. 본문이 원문이고 바닥 글귀는 3D 연출용이다.
- 문단이 둘 이상이고 `chapter.floorEnabled !== false` 이면 아래에 `p.muted` "이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요." 를 붙인다. `floorEnabled` 가 꺼진 장면은 바닥 글귀가 없으므로 이 안내를 생략한다.

이 장면에서 만나는 것들 `.detail-section#detail-figures`
- `h2` "이 장면에서 만나는 것들", 설명 `p` "가까이 다가가면 움직여요."
- `<ul class="figure-list">`: 배치(`chapter.placements`)를 대표 배치(`mainPlacementId`)가 먼저, 나머지는 원래 순서대로. 각 `li`: 색 칩 `.figure-chip`(모델 `color`, `library.models` 에서 `modelId` 로 찾고 없으면 `--accent`), `strong` 배치 `title`, `span` `story`(비어 있으면 생략), 대표 배치에만 배지 "장면의 중심".
- 배치가 없으면 섹션을 만들지 않는다. 850px 이상에서 2열, 아래는 1열이다.

이어지는 장면 `.detail-section#detail-neighbors`
- `<nav aria-label="이어지는 장면">`. 왼쪽에 이전 장면 링크 "← 01 흰 토끼를 따라서", 오른쪽에 다음 장면 링크 "03 버섯 숲의 수수께끼 →". 첫 장면은 이전을, 마지막 장면은 다음을 만들지 않는다. 링크는 `a[data-scene-book][data-scene-chapter]` 이고 `href` 는 `detailUrl`.
- 가운데에 `<a href="{detailUrl book}" data-book>작품 전체 보기</a>`.

원작 정보 `.detail-source` 는 작품 상세와 같다.

## 8. 홈 변경

`client/landing.js`
- `bookCard()`: `<button class="book-entry" data-enter>` → `<a class="book-entry" href="{detailUrl book}" data-book="alice" aria-label="이상한 나라의 앨리스 — 작품 상세">`. `.cover-stage`, `.book-title`, `.book-author` 구조는 유지한다(검사 선택자).
- 장면 카드: `<button class="scene-card">` → `<a class="scene-card" href="{detailUrl scene}" data-scene-book data-scene-chapter aria-label="이상한 나라의 앨리스 · 작아지는 문, 커지는 세계 — 장면 상세">`. 내부 구조 유지.
- 추천 히어로 카드는 `button[data-feature-book]` 그대로 둔다. 슬라이드 전환·스와이프·`inert` 처리가 버튼 전제로 짜여 있어 바꿀 이유가 없다. 도착지만 작품 상세로 바꾸고 `feature-action` 문구를 "이야기 속으로" → "작품 살펴보기", `aria-label` 을 "… 추천 작품 시작" → "… 작품 상세"로 고친다.
- `setupCatalog()` 의 `onEnter` 를 `onOpen(view, bookId, sceneId)` 로 바꾼다. 클릭 위임은 `event.target.closest("button, a[data-book], a[data-scene-book]")` 로 넓히고, 앵커는 `event.button !== 0` 이거나 Ctrl·Meta·Shift·Alt 가 눌렸으면 그대로 두어(새 탭 열기) 브라우저에 맡기고, 아니면 `preventDefault()` 뒤 `onOpen` 을 부른다. 로고 링크가 이미 쓰는 규칙이다.
- `edition()` 과 `bookCover()` 는 새 파일 `client/book-meta.js` 로 옮긴다. `landing.js` 는 PNG 와 CSS 를 import 해서 Node 에서 불러올 수 없는데, `detail.js` 도 이 두 함수가 필요하고 단위 검사 대상이기 때문이다. `landing.js` 와 `main.js` 는 새 경로에서 가져온다.

`client/landing.css`
- `a.book-entry, a.scene-card { color: inherit; text-decoration: none; }` 를 더한다. 나머지 규칙은 클래스 기준이어서 그대로 맞는다. `.book-entry:hover .catalog-cover`, `.scene-card:hover .scene-image` 도 유지된다.

`client/index.html`
- 설명 메타의 "작품을 탐색하고 표지를 누르면 바로 3D 이야기 속으로 들어가는" 을 "작품과 장면을 살펴보고 원하는 곳에서 3D 이야기 속으로 들어가는" 으로 고친다.

## 9. main.js 정리

- `exploring` → `view`. `render()` 는 `view` 로 네 갈래를 그린다. `world` 와 `home` 은 기존 마크업, `book` 은 `bookDetail()`, `scene` 은 `sceneDetail()`.
- `disposeCatalog` 는 `disposeView` 로 이름을 바꾼다. 홈은 `setupCatalog()` 의 해제 함수, 상세는 `setupDetail()` 의 해제 함수를 담는다. `setupDetail()` 은 `main` 에 클릭 위임 하나를 달아 `[data-enter]` 는 `enterBook(id, chapterId)`, `a[data-book]`·`a[data-scene-book]` 은 8절과 같은 규칙으로 `openDetail()` 을 부른다. `AbortController` 로 해제한다.
- `openDetail(view, bookId, sceneId)`: 홈에서 부르면 `catalogState.scroll`·`selected` 를 저장하고, `transitionPage` 안에서 `view`·`book`·`chapter` 를 바꾸고 `history.pushState(null, "", location.pathname + detailUrl(...))` 뒤 `render()`. 장면 상세의 `chapter` 변수는 그 장면을 가리킨다. 3D 진입 시 `enterBook()` 이 다시 정하므로 충돌하지 않는다.
- `bookDetails()` 모달은 3D 월드 안에서만 열리므로 CTA 문구는 항상 "이야기로 돌아가기"다. `!exploring` 이면 `enterBook` 을 부르던 갈래는 죽은 코드가 되어 지운다. 모달 마크업과 `aria-labelledby="book-detail-title"` 은 바꾸지 않는다(검사와 초점 동작 보존). 상세 페이지와 모달은 마크업을 공유하지 않는다.
- `header()`, 푸터, `document.title` 은 3절·5절대로.
- `client/detail.css` 는 `main.js` 에서 import 한다. `detail.js` 는 CSS·이미지를 import 하지 않아야 Node 단위 검사에서 불러올 수 있다. `landing.js` 가 자기 CSS 를 import 하는 관례와 다른 점이며, 이유를 `detail.js` 첫 줄 주석으로 남긴다.
- `Journey` 생성 옵션의 `hero: !exploring` 은 언제나 거짓이던 값이다. `hero: false` 로 적는다.

## 10. 파일 구조

```
client/
  main.js          view 상태, resolveView, render 분기, openDetail, setupDetail   (수정)
  landing.js       카드 → 링크, onOpen, book-meta import                          (수정)
  landing.css      a.book-entry, a.scene-card 규칙                                  (수정)
  book-meta.js     edition(), bookCover(). 자산 import 없는 순수 모듈               (새 파일)
  detail.js        detailUrl(), bookDetail(), sceneDetail(). CSS·이미지 import 없음 (새 파일)
  detail.css       상세 페이지 스타일. main.js 에서 import                          (새 파일)
  transitions.js   reveal 그룹, 기본 초점 대상                                      (수정)
  index.html       설명 메타 문구                                                   (수정)
tests/
  detail.test.js   순수 함수 단위 검사                                              (새 파일)
  catalog.mjs      카드 → 상세 → CTA → 월드 흐름                                    (수정)
  mobile-entry.mjs 같은 흐름의 휴대폰 탭 검사                                       (수정)
  capture.mjs      선택자와 상세 스크린샷                                           (수정)
docs/
  screenshots/detail-book-desktop.png, detail-book-mobile.png,
              detail-scene-desktop.png, detail-scene-mobile.png                     (새 파일)
  preview/detail.png                                capture.mjs 가 만드는 작품 상세 미리보기 (새 파일)
  preview/client.png, explore.png, mobile.png       capture.mjs 가 다시 만든다. 화면은 같아야 한다 (갱신)
  superpowers/specs/2026-09-11-react-next-migration-design.md  10절 주소 규칙       (수정)
README.md                                                                           (수정)
```

`detail.css` 의 반응형 분기점은 `landing.css` 와 같은 1100, 850, 600, 370px 이다.

## 11. 문구

구현이 문구를 새로 만들지 않도록 한 곳에 모은다.

| 자리 | 문구 |
| --- | --- |
| 커튼 | 작품을 펼치는 중이에요… / 장면을 펼치는 중이에요… |
| 작품 CTA | 이야기 속으로 들어가기 / 이어 읽기 + `02 · 장면 제목` / 처음부터 시작하기 |
| 장면 CTA | 이 장면부터 걷기 |
| 섹션 제목 | 이 책의 여정 / 원작 정보 / 미리 읽기 / 이 장면에서 만나는 것들 / 이어지는 장면 |
| 섹션 설명 | 장면을 고르면 그 장면의 이야기를 먼저 볼 수 있어요. / 가까이 다가가면 움직여요. |
| 배지 | 마지막에 머문 장면 / 장면의 중심 |
| 안내 | 이어지는 글은 3D 안에서 장면의 중심 모델에 다가가면 바닥 글귀로 읽을 수 있어요. |
| 이미지 자리 | 표지 이미지 준비 중 / 장면 이미지 준비 중 / 썸네일이 있으면 `{장면} 장면 이미지` |
| 링크 | 작품 전체 보기 / 원작 정보 보기 ↗ |
| 헤더 | 책장으로 |
| 홈 히어로 카드 | 작품 살펴보기 |
| `aria-label` | `{책} — 작품 상세` / `{책} · {장면} — 장면 상세` / `현재 위치` / `이어지는 장면` |

## 12. 오류 처리

- 잘못된 `book`·`scene`·`chapter` 값은 3절의 규칙으로 가까운 화면에 떨어지고 주소를 고쳐 둔다.
- `progress[book.id].chapter` 가 이제 없는 챕터를 가리키면 저장된 장면이 없는 것으로 본다(기존 `find` 동작).
- 공개 도서가 없으면 기존 "새로운 이야기를 준비하고 있어요." 화면이다. 초안 미리보기에서 공개 도서가 없어도 비공개 도서의 상세·월드 주소는 열리고, 홈 주소만 그 화면을 보인다.
- 3D 진입 뒤의 WebGL 실패 처리는 `render()` 의 `world` 갈래에 있는 기존 대체 화면 그대로다.
- 앵커를 새 탭으로 열면 `init()` 이 주소를 해석해 같은 상세를 그린다. `?preview=draft` 는 `detailUrl()` 이 붙여 준다.
- 초안 미리보기에서는 진행 기록을 저장하지 않지만 읽기는 한다(기존). 이전에 저장된 장면이 있으면 "이어 읽기" CTA 가 나올 수 있다. 3D 안 모달도 같은 규칙이므로 그대로 둔다.

## 13. 접근성과 반응형

- 전환 후 초점은 `h1#detail-title`. 화면은 맨 위로 스크롤된다.
- 브레드크럼과 이어지는 장면은 `nav` 에 `aria-label`, 현재 항목은 `aria-current="page"`.
- 여정 목록은 `ol`, 장면 행은 번호·제목·부제가 모두 링크 글자라 스크린 리더가 한 덩어리로 읽는다. 칩과 아이콘은 `aria-hidden`.
- 이미지 자리는 `role="img"` 와 `aria-label`(기존 표지 자리와 같은 방식).
- 휴대폰 CTA 고정 바는 `env(safe-area-inset-bottom)` 을 더한다. 페이지 끝에 CTA 높이만큼 여백을 두어 원작 정보가 가려지지 않게 한다.
- 새 애니메이션은 없다. 등장 순서는 `transitions.js` 가 `prefers-reduced-motion` 을 처리한다.
- 브레드크럼은 600px 이하에서 한 줄에 맞도록 책 제목을 `text-overflow: ellipsis` 로 자른다.

## 14. 테스트

### 14.1 단위 검사 `tests/detail.test.js`(`npm test` 에 포함)

`client/detail.js` 와 `client/book-meta.js` 를 Node 에서 import 한다. 도서 데이터는 `server/seed.js` 의 앨리스·오즈를 쓴다.

- `detailUrl`: `{book}` → `?book=alice`, `{book, scene}` → `?book=alice&scene=alice-2`, `{book, chapter}` → `?book=alice&chapter=alice-1`, `preview: true` 면 `&preview=draft` 가 붙는다.
- `bookDetail`: 제목·영문 제목·저자·연도·분류·장면 수·소개가 들어 있다. 저장 없음이면 "이야기 속으로 들어가기" 하나, 저장 있음이면 "이어 읽기"와 `02 · …`, "처음부터 시작하기", 그 행에만 "마지막에 머문 장면" 배지. 여정 행은 챕터 수만큼이고 `href` 가 `detailUrl` 과 같다. 대표 모델 이름이 행에 있다.
- `sceneDetail`: 첫 문단만 있고 둘째 문단은 없다. `floorEnabled: false` 면 안내 문구가 없다. 본문이 빈 챕터는 미리 읽기 섹션이 없다. 배치는 대표 배치가 첫 항목이고 "장면의 중심" 배지가 하나다. 첫 장면은 이전 링크가, 마지막 장면은 다음 링크가 없다. 배치가 없는 챕터는 만나는 것들 섹션이 없다.
- 모든 마크업은 `esc()` 를 거친다. 제목에 `<` 가 든 가짜 책으로 확인한다.
- 표지와 장면 썸네일: 표지(`cover`)를 넣은 앨리스의 `bookDetail` 은 `.detail-cover` 안에 그 `<img>` 하나를 그리고 "표지 이미지 준비 중"이 없다. 썸네일(`thumbnail`)을 넣은 2장의 `sceneDetail` 은 `scene-image image-placeholder has-image`, 그 `<img>`, `aria-label="작아지는 문, 커지는 세계 장면 이미지"` 를 가진다. 시드에는 표지와 썸네일이 없으므로 나머지 시드 기반 검사는 `<img>` 가 없음을 확인한다.

### 14.2 브라우저 검사 `tests/catalog.mjs`(4336 포트)

기존 단계 사이에 상세 단계를 끼워 넣는다.

1. 검색·분류·정렬 단계(기존) 뒤: `[data-book="alice"]` 클릭 → `.detail-page[data-view="book"]` 표시, `#detail-title` 이 "이상한 나라의 앨리스", 주소 `?book=alice`, `#detail-title` 에 초점, `.journey-row` 6개, CTA 문구 "이야기 속으로 들어가기". `.detail-cta .primary-button` 클릭 → `#world canvas`, 주소 `book=alice&chapter=alice-1`, 커튼 없음. 이어서 기존 "작품 소개" 모달 검사.
2. 3D 안 이동·챕터 이동(기존). "책장으로" → `.catalog-card` 2개(기존).
3. "읽던 작품 이어 보기" → `[data-book="alice"]` 클릭 → CTA 에 "이어 읽기"와 "02" → 클릭 → `#map-button` 에 "02"(기존 단정). `reload` 뒤에도 "02"(기존).
4. `goBack()` → `.detail-page[data-view="book"]`(지금은 `.library-page` 를 단정한다). 한 번 더 `goBack()` → `.library-page`. `goForward()` 두 번 → `#map-button` "02".
5. 새 단계: 홈에서 `[data-scene-chapter="alice-3"]` 클릭 → `.detail-page[data-view="scene"]`, 주소 `book=alice&scene=alice-3`, `#detail-preview .reading-text p` 가 한 문단, `.figure-list li` 3개, 첫 항목에 "장면의 중심", 이전 링크가 "02", 다음 링크가 "04". CTA 클릭 → `#world canvas`, 주소 `chapter=alice-3`.
6. 새 단계: 홈에서 `.feature-card.is-active`(첫 슬라이드, 앨리스) 클릭 → `.detail-page[data-view="book"]`, `#detail-title` 이 "이상한 나라의 앨리스". "책장으로" → 홈이 다시 그려지면 첫 슬라이드가 활성이므로 `.feature-card.is-active` 에 초점이 돌아온다. 스크롤 위치가 저장값으로 복원된다. 저장한 선택자의 요소가 없거나 `inert` 라 초점을 받지 못하면 `openLibrary()` 가 먼저 준 `#catalog-title` 초점이 남는다. 이 경우는 검사하지 않는다.
7. 새 단계: 주소를 직접 열어 해석 규칙을 확인한다. `?book=alice` 와 `?book=alice&scene=alice-2` 는 각 상세와 문서 제목, `?book=nope` 와 `?scene=alice-2` 는 홈과 `/client/` 로 정리된 주소, `?book=alice&chapter=nope` 는 작품 상세와 `?book=alice`, `?book=alice&scene=nope&preview=draft` 는 작품 상세와 `?book=alice&preview=draft`, 그리고 여정 첫 행의 `href` 에 `preview=draft` 가 남아 있는지 본다.
8. 홈 화면 관리 묶음(main 에서 합쳐진 "Studio covers…" 단계, 가로챈 `/api/library` 응답) 안에서: 표지가 있는 `[data-book="alice"]` → 작품 상세의 `.detail-cover img` 1개 → "책장으로", 썸네일이 있는 장면 카드(`a.scene-card` 중 `.scene-image.has-image` 를 가진 것) → 장면 상세의 `.detail-hero--scene .scene-image.has-image img` 1개 → "책장으로".

### 14.3 `tests/mobile-entry.mjs`(4321 포트)

`[data-enter="alice"] .cover-stage` 탭을 `[data-book="alice"] .cover-stage` 탭으로 바꾼다. 탭 뒤 `.detail-page[data-view="book"]` 을 기다리고, 스크롤 없이 보이는 `.detail-cta .primary-button` 을 같은 `tapVisible` 로 탭한다. 그 뒤의 `.library-page` 없음, `.journey-controls` 애니메이션 종료, `#map-button` 단정은 그대로다. 이 검사는 화면 밖 버튼을 자동 스크롤하지 않고 탭하는 것이 목적이므로 CTA 도 같은 방식으로 누른다.

### 14.4 `tests/capture.mjs`

`[data-enter="alice"]` 를 `[data-book="alice"]` 로 바꾸고, 클릭 뒤 `.detail-page` 를 `docs/preview/detail.png` 로 찍은 다음 CTA 를 눌러 기존 `explore.png` 를 찍는다.

### 14.5 회귀

`npm test`, `npm run build`, `node tests/catalog.mjs`, `node tests/mobile-entry.mjs`, `node tests/home-admin.mjs`, `npm run test:about` 을 통과해야 한다. `home-admin.mjs` 는 이제 홈 책장 카드의 `[data-book]` 선택자를 쓴다. `browser.mjs`, `floor-reading.mjs`, `collision.mjs`, `admin-parity.mjs`, `floor-editor.mjs` 는 `?book&chapter` 주소로 바로 들어가므로 이 변경에 영향받지 않는다. 이 중 `browser.mjs`, `workspace.mjs`, `floor-reading.mjs` 는 이 작업 전부터 실패하는 항목이 있어 회귀 판단에서 제외한다.

스크린샷은 1440×960 과 390×844 에서 작품 상세와 장면 상세를 각각 찍어 10절의 네 파일로 둔다. 소개 페이지 스크린샷(`about-desktop.png`, `about-mobile.png`)과 같은 이름 규칙이다.

## 15. 문서 반영

- `README.md`: "도서를 누르면 해당 작품의 3D 공간으로 바로 들어갑니다" → 작품 상세를 거쳐 CTA 로 들어간다는 설명. "장면 목록은 … 선택한 장면의 3D 공간으로 바로 들어갑니다" → 장면 상세 경유. "**작품 소개**에서 원작 정보와 장면 목록을 확인합니다" → 홈에서는 작품 상세, 3D 안에서는 작품 소개 모달. 확인 순서 1 을 "표지를 눌러 작품 상세를 열고 '이야기 속으로 들어가기'를 누른 뒤" 로 고친다.
- 전환 스펙 10절(사용자 앱): `ReaderApp` 이 읽는 쿼리에 `book` 단독(작품 상세)과 `scene`(장면 상세)을 추가하고, 화면 상태 넷과 이 설계 파일을 가리키는 한 문장을 둔다. App Router 경로로 바꿀지는 6단계 계획에서 정한다고 적는다.
- `docs/DEPLOYMENT.md` 는 바뀌지 않는다. rewrite 와 서버 경로가 그대로다.

## 16. 위험과 대응

- 3D 도달까지 클릭이 하나 늘어난다. CTA 를 히어로 바로 아래 첫 화면에 두고 휴대폰에서는 고정 바로 항상 보이게 한다.
- 상세끼리 이동할 때 커튼이 잦게 보일 수 있다. 문구를 짧게 두고, 사용 후 불편하면 상세 간 이동만 커튼 없이 그리는 조정을 별도 작업으로 한다. 이 설계에서는 한 가지 전환 경로만 쓴다.
- `.book-entry` 와 `.scene-card` 가 `a` 가 되면서 버튼 리셋에 의존하던 스타일이 어긋날 수 있다. 8절의 두 규칙을 더하고 홈 스크린샷을 변경 전과 비교한다.
- `catalog.mjs` 가 길어진다. 단계마다 `pass()` 를 두어 실패 지점을 바로 알 수 있게 유지한다.
- `preview=draft` 가 상세 링크에서 빠지면 초안 미리보기가 공개본으로 새어 나간다. 주소 생성을 `detailUrl()` 한 곳에 두고 단위 검사로 막는다.
- `mainPlacementId` 가 `null` 인 챕터(배치 없음)에서 대표 모델·"장면의 중심"을 찾다 오류가 날 수 있다. 두 함수 모두 배치가 없으면 생략하도록 14.1 에서 검사한다.

## 17. 완료 기준

- 홈의 도서 카드·장면 카드·추천 히어로 카드·읽던 이야기 카드가 모두 상세 페이지로 이동하고, 홈에서 3D 월드로 바로 들어가는 경로가 없다.
- `?book=alice` 와 `?book=alice&scene=alice-2` 를 새로고침·새 탭·뒤로가기로 열어도 같은 화면이 나온다. `?book=alice&chapter=alice-1` 은 지금처럼 3D 월드다.
- 작품 상세 CTA 가 저장된 장면 유무에 따라 문구와 도착 장면을 바꾸고, 장면 상세 CTA 가 그 장면으로 들어간다.
- 등록된 표지·장면 썸네일은 보이고, 없는 칸은 비어 있으며 장면 자리는 테마 색만 다르다.
- 3D 월드 안의 작품 소개 모달과 이야기의 지도는 이전과 같이 동작한다.
- 14.5 의 검사가 통과하고 스크린샷 네 장이 있다. README, `index.html`, 전환 스펙 10절이 갱신되어 있다.
