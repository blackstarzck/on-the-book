# 홈 화면 관리 1차 작업 계획

## 배경

사용자 화면 첫 페이지가 책장 홈으로 바뀌었다(커밋 4d897ae). 그런데 홈의 이미지와 문구는 코드에 고정돼 있거나 규칙으로 정해진다.

- 히어로: 저장 순서상 앞의 두 권 (`client/landing.js:59`)
- 분류: 책 ID로 고정 (`landing.js:24`)
- 표지: 관리자에서 올려도 일부러 비워 둔다 (`landing.js:27`)
- 장면 카드: 썸네일 필드가 없다

관리자가 이 항목들을 직접 관리하는 최소 형태를 만든다.

### 결정 사항 (2026-09-28)

| 항목 | 결정 |
|---|---|
| 범위 | 표지 표시, 챕터 썸네일, 히어로 슬라이드, 작품 분류, 작품 순서 |
| 이미지 형식 | PNG 그대로. 기존 업로드 경로(`/api/floor/upload`, 5MB·4096px, 배포 환경 직접 전송)를 쓴다 |
| 히어로 구도 | 사진을 카드 전체에 채우고 글을 위에 얹는다. 이미지가 없는 슬라이드는 지금 모습(그라데이션 + 분류 아이콘)을 유지한다 |
| 히어로 링크 | **미정.** 나중에 새로 만들 상세 페이지로 연결할 예정이다. 이번에는 슬라이드에 `bookId`만 두고, 누르면 지금처럼 그 책의 3D 공간으로 들어간다 |
| 스택 | 소개 페이지 때처럼 현재 스택(Vite + 바닐라 JS). 전환 스펙과 1단계 계획에 반영한다 |

## 설계

### 데이터 (`shared/schema.js`)

- **`book.category`**
  - 문자열: 앞뒤 공백 제거, 최대 8자, 기본값 `''`.
  - `all`·`reading`은 거부한다. 필터 상태 예약어(`landing.js:130`, `135`, `208`)와 겹치기 때문이다.
  - 8자로 제한하는 이유는 320px 화면의 빠른 메뉴 3열 칸에 들어가는 길이라서다.
- **`chapter.thumbnail`**: `/uploads/<uuid>.png` 또는 `''`, 기본값 `''`.
- **`library.home`**
  - 형태: `{ hero: HeroSlide[] }`, 슬라이드 최대 5개.
  - 기본값은 `.prefault({})`로 준다. `.default({hero: []})`는 여러 번의 파싱이 같은 배열을 공유한다(직접 확인함).
- **`HeroSlide`**: `{ id, bookId, image, focus, kicker, title, description }`
  - `focus`는 `left`·`center`·`right` 중 하나이고 기본값은 `center`다. 사진을 잘라 보여 줄 때 기준이 된다.
  - 문구는 비우면 기본값을 쓴다.
- **`superRefine`**
  - 슬라이드 ID를 중복 검사에 넣는다.
  - `bookId`가 없는 책을 가리키면 거부한다: "추천 슬라이드에 연결된 책을 찾을 수 없습니다."
- **배포 데이터 주의**
  - 배포 환경은 데이터를 읽을 때 정규화하지 않는다(`server/storage.js` readLibrary).
  - 새 필드가 없는 기존 데이터를 서버와 화면이 모두 기본값으로 처리해야 한다.

### 공용 도우미 (새 파일 `shared/home.js`, 부수효과 없음)

- **`bookCategory(book)`**
  - `category`가 비어 있으면 옛 대응표(`alice`→판타지, `oz`→모험)를 보고, 거기도 없으면 `'문학'`을 돌려준다.
  - 운영 데이터가 다시 저장되기 전에도 지금 화면이 유지된다.
- **`heroSlides(books, home)`**
  - 주어진 책 목록에 있는 슬라이드만 남긴다.
  - 남은 슬라이드가 없으면 앞의 두 권(한 권뿐이면 한 권)으로 대체한다.
- **`heroKicker(slide, index)`**: 비어 있으면 "오늘의 이야기" / "한 걸음, 새로운 모험".

### 서버

**새 파일 `server/publication.js`**
- 부수효과가 없어야 한다. `storage.js`를 불러오면 안 된다. 불러오는 순간 최상위 await가 실제 `data/library.json`을 읽고 다시 쓴다.
- `publicLibrary(db)`
  - 기존 응답(공개 책, 사용 중인 모델, `publishedAt`)에 `home.hero`를 더한다.
  - `db.live.home?.hero ?? []`에서 공개 책을 가리키는 슬라이드만 넣는다. `?.`가 없으면 옛 배포 데이터에서 `/api/library`와 모든 이미지 요청이 실패한다.
- `publicAssetNames(db)`
  - `publicLibrary(db)` 결과를 순회해 `url`·`thumbnail`·`cover`·`asset`·`image` 키의 `/uploads/<uuid>.(png|glb)` 값만 모은다.
  - 본문에 적힌 주소 문자열은 포함하지 않는다.
  - 기존 `storage.js:102`의 함수는 이리로 옮기고 삭제한다.

**`server/index.js`**
- `GET /api/library` → `res.json(publicLibrary(db))`.
- 배포 환경 `/uploads/:filename` → 새 허용 목록을 쓴다.
  - PNG는 `Cache-Control: private, max-age=300`으로 바꾼다. 서명된 주소가 10분간 유효하므로 그보다 짧게 둔다.
  - 지금은 `no-store`라서 홈을 열 때마다 이미지 수만큼 함수 실행과 `library.json` 읽기가 일어난다.
  - 대신 비공개로 바꾼 뒤에도 최대 5분은 브라우저 캐시에 남는다.
- `PUT /api/studio`의 이미지 확인(150~154번째 줄)을 도우미 하나로 바꾼다.
  - 대상: 표지, 바닥 이미지, 바닥 배치 이미지, 챕터 썸네일, 히어로 이미지.
  - 현재 초안에 **없던 주소만** 확인한다. 배포 환경의 `readAsset`은 파일 전체를 차례로 받으므로, 매번 모두 확인하면 60초 제한에 걸릴 수 있다.
  - 파일이 없으면 400 "등록한 이미지 파일을 찾을 수 없습니다. 다시 올려 주세요."를 돌려준다. 지금은 500과 "모델 파일" 문구가 나온다.

**`server/seed.js`**: `alice`·`oz`에 분류를 적는다.

### 사용자 화면 (`client/landing.js`, `landing.css`, `main.js`)

**표지** (`bookCover(book)`)
- 표지가 있으면 `<img alt="" loading="lazy" decoding="async">`를 넣고 `object-fit: cover`로 채운다.
- 없으면 지금 빈 자리를 유지한다. 빈 필드에는 이미지 요청을 만들지 않는다(`tests/about.mjs`가 4xx를 실패로 본다).
- `.cover-stage`는 누르는 영역으로 유지한다(`tests/mobile-entry.mjs:57`).

**장면 카드**
- 썸네일이 있으면 16:10 자리에 이미지를 넣는다.
- 번호와 화살표에는 밝은 칩 배경을 깔아 이미지 위에서도 읽히게 한다.

**히어로**
- 슬라이드를 `heroSlides(books, library.home)`로 만든다. 진행 표시, 자동 재생, 화살표를 슬라이드 수에 맞춘다.
  - 0개면 구역을 그리지 않는다.
  - 1개면 화살표와 재생 버튼을 숨긴다.
  - `setupCatalog`는 히어로가 없을 때 관련 연결(`landing.js:77-80`, `163-195`, `226`)을 건너뛴다.
- `slide.image`가 있으면 `.feature-card--photo`로 그린다.
  - 사진은 `inset:0; object-fit:cover`로 깔고, `object-position`은 `focus`를 따른다.
  - 어두운 그라데이션을 깔고 글과 번호는 흰색으로 한다. 데스크톱은 왼쪽 그라데이션, 600px 이하는 아래쪽 그라데이션이다.
- 슬라이드는 같은 자리에 겹쳐 있어서 `loading="lazy"`가 통하지 않는다.
  - 첫 슬라이드만 바로 `src`를 넣는다.
  - 나머지는 `data-src`로 두고, 처음 활성화될 때와 그 직전에 다음 장을 미리 불러올 때 넣는다.

**분류**
- `edition()`은 `bookCategory`를 쓴다.
- 모든 분류 값에 `esc()`를 적용한다: `landing.js:60`·`62`, `main.js:215`.
- 아이콘 대응표는 `Object.hasOwn`으로 조회한다(`landing.js:20`, `41`). `constructor` 같은 이름이 걸리지 않게 하기 위해서다.
- 빠른 메뉴: 데스크톱은 줄바꿈을 허용한다. 휴대폰은 칸 안에서 말줄임으로 처리한다(`landing.css:69`, `146`).

**초안 미리보기 홈**
- 공개 대상 책만 거른 **같은 객체**를 `landing()`(`main.js:63`)과 `setupCatalog()`(`main.js:100`)에 넘긴다.
- 빈 책장 판정(`main.js:309`)도 거른 목록 기준으로 한다.
- 주소로 비공개 책의 챕터를 미리 보는 기능(`enterBook`, `popstate`의 전체 초안 사용)은 유지한다.

### 관리자 (`admin/main.js`, `admin/workspace.js`, 스타일)

**사이드바 새 탭 "홈 화면"** (`home`, 아이콘 `layers`)
- `render()`의 두 삼항식(142번째 줄, 제목과 본문)에 `home`을 넣고 연결 함수를 둔다.
- 추천 슬라이드 목록(최대 5개). 카드마다 들어가는 것:
  - 이미지 업로드·미리보기·지우기
  - 초점 선택
  - 연결 책(비공개 책은 "사용자 화면에 나오지 않음"으로 표시)
  - 작은 문구, 제목, 설명(빈칸 안내로 기본값을 보여 줌)
  - 위·아래 이동, 삭제
- 목록이 비면 지금 자동으로 나오는 책을 안내한다.
- 입력 중에는 데이터만 바꾸고 `mark()`는 change 이벤트에서 부른다(`workspace.js:104`와 같은 방식). 구조가 바뀔 때만 다시 그린다.
- "홈 미리보기"
  - `previewClient`(`admin/main.js:715`)를 `openPreview(query, title)`로 일반화한다.
  - 임시 저장한 뒤 `/client/?preview=draft`를 연다.
  - iframe 제목과 `#preview-mobile`은 그대로 둔다.

**도서 정보 창** (`editBook`, `admin/main.js:282`)
- 분류는 필수 입력으로 한다. 기존 분류와 판타지·모험·문학을 `datalist`로 제안하고, 초기값은 `bookCategory`.
- 표지 미리보기와 "표지 지우기"를 넣는다.
- 책을 삭제하면 그 책을 가리키는 슬라이드도 지운다.

**챕터 편집 창** (`editChapter`, `admin/main.js:355`)
- 썸네일 업로드·미리보기·지우기를 넣는다.
- 동작하지 않던 표지 처리 코드(372~375번째 줄)를 이것으로 바꾼다.
- 이 창에는 `type="submit"` 버튼이 없다. 업로드 중에는 창의 적용 버튼과 앞·뒤 이동 버튼을 직접 찾아 막는다.

**도서 보관함 정렬** (`workspace.js:11` shelfHTML)
- 타일이 `<button>`이라 손잡이를 안에 넣을 수 없다. 각 타일을 `.book-tile-row`로 감싸고 옆에 별도 손잡이를 둔다. `.book-tile`과 `[data-open-book]`은 유지한다(`tests/leave-guard.mjs` 등이 사용).
- 챕터 정렬(`workspace.js:128-137`)을 따르되, 격자이므로 가로 위치로 앞·뒤를 판정한다.
- 칸 사이 빈 곳에 놓으면 무시한다.
- 키보드는 Alt+←/→이고, 다시 그린 뒤 손잡이에 포커스를 되돌린다.
- 검색·상태 필터가 켜져 있으면 정렬을 막고 안내한다. 필터는 감싼 요소 단위로 숨긴다.

**공통**
- `load()`에서 `library.home ??= { hero: [] }`를 기준 복사본을 만들기 전에 적용한다. 그래야 불러오자마자 변경으로 잡히지 않는다.
- 이미지 업로드는 `uploadImage(file)` 도우미로 모은다.
- 도서 편집기에 들어갈 때 실행 취소 기록을 비운다. 편집기의 Ctrl+Z가 보이지 않는 곳의 변경(홈 화면·정렬)을 되돌리지 않게 하기 위해서다.
- 권장 크기 안내문

| 이미지 | 권장 크기 | 참고 |
|---|---|---|
| 표지 | 세로 2:2.85 (예: 800×1140) | |
| 챕터 썸네일 | 16:10 (예: 1280×800) | |
| 히어로 | 가로 사진 (예: 2400×1000, 5MB 이하) | 데스크톱 약 3.4:1, 휴대폰 약 0.8:1로 잘린다 |

## 작업 순서 (단계마다 커밋, PR은 요청할 때)

**0. 계획 문서.** 이 계획을 `docs/superpowers/plans/2026-09-28-home-management.md`로 저장하고 커밋한다.

**1. 데이터·서버 (테스트 먼저)**
- 대상 파일: `shared/schema.js`, 새 `shared/home.js`, 새 `server/publication.js`, `server/index.js`, `server/storage.js`, `server/seed.js`
- 새 테스트 `tests/home.test.js`
  - 새 필드의 기본값과 기본값 비공유
  - 잘못된 썸네일 경로, 예약어 분류, 없는 책을 가리키는 슬라이드 거부
  - `bookCategory`·`heroSlides`의 대체 동작
- 새 테스트 `tests/publication.test.js`
  - `home` 없는 원본 데이터도 처리하는지
  - 기존 필드에서 옛 허용 목록과 같은 결과가 나오는지
  - 비공개 책의 표지·썸네일·히어로 이미지와 쓰지 않는 모델은 제외하는지
  - 본문에 적힌 주소는 제외하는지
- `tests/server.test.js`
  - `/api/library`의 `home` 필터링
  - 없는 파일을 가리키는 챕터 썸네일을 저장하면 400을 주는지

**2. 사용자 화면**
- 대상 파일: `client/landing.js`, `client/landing.css`, `client/main.js`
- `tests/catalog.mjs`
  - 기존 예시 데이터 검사(빈 표지, 빠른 메뉴 6개, 첫 히어로 앨리스)는 그대로 통과해야 한다.
  - 새 시나리오를 추가한다. 가짜 응답(`/api/library`, `**/uploads/**`)으로 다음을 확인한다.
    - 표지 이미지와 장면 썸네일이 보이는지
    - 사진 히어로와 직접 입력한 문구가 나오는지
    - 없는 책을 가리키는 슬라이드를 건너뛰는지
    - 슬라이드가 1개일 때 조작 버튼이 숨는지
    - 직접 입력한 분류로 필터가 동작하는지
    - 320·390·768·1440px에서 가로 넘침이 없는지
- **확인 지점:** 사진 히어로는 새 디자인이다. 1440·768·390px 스크린샷을 사용자에게 보여 주고 승인을 받은 뒤 3단계로 간다.

**3. 관리자**
- 대상 파일: `admin/main.js`, `admin/workspace.js`, `admin/style.css`(또는 `workspace.css`)
- 새 테스트 `tests/home-admin.mjs`(포트 4341). 캔버스로 PNG를 만들어 다음 흐름을 확인한다.
  1. 표지와 분류 입력
  2. 책 순서 바꾸기(드래그와 Alt+←/→)
  3. 챕터 썸네일 등록
  4. 슬라이드 추가(oz 연결, 이미지·문구·초점)
  5. 홈 미리보기(넓은 화면·모바일)
  6. 공개 → `/api/library`와 사용자 화면에 반영됐는지
  7. oz를 비공개로 바꾸고 다시 공개 → 슬라이드가 빠지고, 공개된 앨리스 한 권이 기본 슬라이드로 나오는지
  8. 페이지 오류가 0건인지

**4. 문서**
- `README.md`
  - 이미지 칸을 비워 둔다는 설명(31번째 줄) 삭제
  - 새 책은 "문학"이라는 설명(30번째 줄) 수정
  - 첫 실행 시 백업과 다시 쓰기 설명(79번째 줄 부근) 보완
  - 새 검증 명령과 포트 추가
- `docs/ADMIN-GUIDE.md`: 홈 화면 탭, 표지·분류·순서·챕터 썸네일, 권장 크기
- `docs/PRD.md`: 관리자 요구사항 A-12(홈 화면 관리) 추가
- `docs/DEPLOYMENT.md`
  - 새 관리자에서 한 번 저장·공개해야 새 필드가 생긴다는 점
  - 미리보기 배포들이 저장소 하나를 같이 쓰는 문제: 옛 브랜치 미리보기에서 저장하면 새 필드가 지워진다
  - 배포 뒤 이미지가 404 없이 나오는지 확인하는 절차
- 전환 스펙(`docs/superpowers/specs/2026-09-11-react-next-migration-design.md`)
  - §3: 새 필드와 `/api/library`의 `home`
  - §6.5: 이미지 확인과 슬라이드 참조 검증
  - §7.3·§16 2단계: 옛 `HeroScene`과 히어로 스크린샷 정리
  - §9: 홈 화면 탭, 도서 정렬, 책 지정 없는 홈 미리보기
  - §10: 215번째 줄의 옛 히어로 설명을 책장 홈 설명으로 교체
  - §14·§16: `catalog.mjs`와 `home-admin.mjs`
- 1단계 계획(`docs/superpowers/plans/2026-09-14-phase1-monorepo-api.md`)
  - 스키마 복사본(423·478·488~515번째 줄)
  - storage 내보내기(772번째 줄)와 `publicAssetNames` 테스트(1013~1022번째 줄)
  - 파일 존재 확인(1660번째 줄)
  - `getLibrary`(1716~1720번째 줄)와 `LibraryResponse`(2960번째 줄)의 `home`

## 재사용할 기존 코드

- 업로드와 배포 환경 직접 전송: `shared/ui.js:72` `api()`, `server/index.js:204`
- 업로드 입력란과 미리보기: `.upload-field`, `.thumbnail-preview`, 모델 썸네일 창(`admin/main.js:510`)
- 끌어서 정렬: `admin/workspace.js:128-137`
- 미리보기 대화상자(넓은 화면·모바일): `admin/main.js:715`
- 변경 표시와 실행 취소: `mark()`(`admin/main.js:72`)
- 이스케이프: `esc()`(`shared/ui.js`)

## 위험과 대응

- **배포 환경의 기존 데이터:** 새 관리자에서 저장·공개하기 전까지 새 필드가 없다. 서버와 화면의 기본값 처리로 지금과 같은 화면을 유지하고, 배포 문서에 절차를 적는다.
- **로컬 첫 실행:** 새 기본값 때문에 한 번 백업을 만들고 버전을 올린다. 이미 열려 있던 관리자 창은 새로고침 전까지 저장 시 409가 난다. 테스트는 새 데이터 폴더를 쓰므로 영향이 없다.
- **PNG 사진 용량:** 5MB 제한 안에서도 무겁다. 첫 히어로 외에는 늦게 불러오고, 적당한 크기를 안내한다. WebP는 후속 과제다.

## 검증

1. `npm test`: 단위·서버 테스트 통과.
2. `npm run build`: 이어서 `node tests/catalog.mjs`, `node tests/home-admin.mjs`.
3. 회귀 검사: `npm run test:mobile`, `npm run test:about`, `node tests/model-thumbnails.mjs`, `node tests/leave-guard.mjs`.
4. 작업 전 기준을 잡는다. 1단계를 시작하기 전에 작업 전 커밋(9807d3f)에서 위 회귀 검사와 `tests/admin-parity.mjs`를 한 번 돌린다.
   - 기록된 원래 실패: `tests/browser.mjs`, `tests/workspace.mjs`, `tests/floor-reading.mjs`
   - `admin-parity.mjs`는 옛 첫 화면(`#edit-story`)을 전제로 하므로 이미 실패할 가능성이 높다.
   - 기준과 다른 지점에서 나는 실패만 새 회귀로 본다.
5. 직접 확인: `npm run dev`를 켜고 관리자 홈 화면 탭에서 사진 슬라이드를 만든다. 홈 미리보기를 넓은 화면·모바일로 보고, 공개한 뒤 `/client/`를 새로고침한다.
6. 배포 환경 허용 목록: 검증은 `tests/publication.test.js`가 맡는다(`tests/cloud.mjs`는 Blob 토큰이 필요하다). 가능하면 미리보기 배포에서 이미지가 404 없이 나오는지 사용자와 함께 확인한다.

## 범위 밖 (후속)

- 히어로 링크 대상(향후 상세 페이지), 휴대폰용 히어로 이미지를 따로 받기
- 상단 띠 배너, 분류 아이콘, 섹션 문구, 트레일러 영상, 이용 가이드
- WebP·JPEG 지원, 소개 페이지 관리
