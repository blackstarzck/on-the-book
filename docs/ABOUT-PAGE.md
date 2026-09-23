# 소개 페이지(/about)

브랜드 시안 sample-02를 사용자 화면의 소개 페이지로 옮겼습니다. 주소는 `/about`이며 로컬에서는 `/client/about/`으로 이동합니다. 설계는 [소개 페이지 설계](superpowers/specs/2026-09-23-about-page-design.md)에 있습니다.

## 출처

- 시안: 저장소 옆 폴더 `../on-the-book-brand/sample-02`(2026-09-22 판)
- 옮긴 파일: `index.html`, `app.js`(→ `main.js`), `styles.css`(→ `style.css`), `scene.js`, `clay-scene.js`, `journey-camera.js`, `journey-labels.js`, `journey-presentation.js`, 페이지가 참조하는 에셋
- 옮기지 않은 원본: Blender 편집 파일과 모델 스크립트(`models/`), 생성 이미지 원본과 생성 지시(`models/generated-images/`), 조사·검토 자료(`review/`). 시안 폴더에서 확인합니다.

## 확인할 동작

| 구간 | 확인할 동작 |
| --- | --- |
| 첫 화면의 책과 정원 | 책을 좌우로 끌어 돌립니다. 책 색은 2초마다 바뀌고, 아래로 스크롤하면 책의 방향과 페이지 간격이 달라지며 정원이 자랍니다. |
| 짙은 초록의 이야기 구간 | 스크롤하면 점토 나선길을 따라 시선이 전진하고, 세 사진에 도착할 때마다 햇빛과 사진 옆 설명이 나타납니다. 위로 스크롤하면 되돌아갑니다. |
| 걷고·다가가고·읽고 | 컴퓨터에서는 세 열이 잠시 고정되고 구간이 차례로 바뀝니다. 단어를 누르거나 방향키·Home·End로 이동합니다. 폭 760px 이하에서는 세로로 이어집니다. |
| 장면 갤러리 | 끌거나 이전·다음 버튼, 방향키·Home·End로 넘깁니다. 이미지를 누르면 크게 보는 창이 열립니다. |
| 브랜드 필름 | 스크롤하면 필름이 화면 너비까지 펼쳐지고 음소거로 재생됩니다. 누르면 소리와 조작이 있는 영상 창이 열립니다. |
| 푸터 | 선화와 글이 스크롤에 따라 나타납니다. 'On the Book 시작하기'는 사용자 화면 첫 화면으로 이동합니다. |
| 모션 | 왼쪽 아래 '모션 켜짐'을 누르면 움직임을 끄고 문서처럼 읽습니다. 기기의 움직임 줄이기와 높이 650px 이하 화면에서도 같습니다. |

사용자 화면 헤더의 '소개'에서 이 페이지로 들어옵니다. 관리자 초안 미리보기에는 이 링크가 없습니다.

## 시안과 달라진 점

| 시안 | 소개 페이지 |
| --- | --- |
| 폴더에 복사한 Three.js(`public/assets/vendor`) | 프로젝트 의존성 `three` 0.180 |
| `config.js`의 서비스 주소 | '시작하기' 링크를 `/`로 고정 |
| 시안 전용 파비콘 | 사용자 화면과 같은 `/brand/*` 아이콘 |
| 장면 카드 4장·점토 길 대체 이미지 PNG | WebP(품질 90, 크기 동일, 대체 이미지는 투명 유지) |
| 자체 정적 서버와 빌드 스크립트 | client Vite 빌드의 `about` 입력, Express·Vercel 주소 연결 |

화면 구성, 문구, 글꼴(Manrope, Noto Sans KR), 색, 로고, 움직임은 바꾸지 않았습니다.

## 에셋

`client/about/assets/`에는 페이지가 참조하는 파일 17개만 있습니다. 빌드하면 해시가 붙은 파일명으로 나가며 관리자 빌드에는 들어가지 않습니다.

| 파일 | 처리 | 크기 |
| --- | --- | --- |
| `trailer.mp4` | 그대로 | 9.0MB |
| `clay-journey.glb`, `clay-journey.json` | 그대로 | 1.4MB, 87KB |
| `journey-walk.webp`, `journey-approach.webp`, `journey-read.webp` | 그대로 | 합계 1.1MB |
| `garden.webp`, `wander.webp`, `invitation.webp` | 그대로 | 합계 406KB |
| `footer-books-hairline.webp`, `footer-door-hairline.webp`, `footer-reader-hairline.webp` | 그대로 | 합계 266KB |
| `scene-concepts/card-0N-*-a.webp` 4장 | PNG에서 변환 | 합계 1.3MB |
| `clay-journey-poster.webp` | PNG에서 변환 | 39KB |

변환 명령입니다.

```bash
ffmpeg -i <원본>.png -c:v libwebp -quality 90 -compression_level 6 <대상>.webp
```

## 검증

- `npm test`: 빌드 입력(client·about·admin)과 로컬 `/about` 이동을 확인합니다.
- `npm run test:about`: 빌드 후 브라우저 검사를 실행합니다. 책·점토 길·구간 이동·갤러리·필름·모션·대체 화면·휴대폰 폭·헤더 링크와 관리자 빌드의 링크 제외를 확인합니다. PowerShell에서 `$env:ABOUT_BASE_URL = "http://127.0.0.1:4173"; node tests/about.mjs`로 실행 중인 서버를 검사할 수도 있습니다.
- `node tests/about-compare.mjs <기준 주소> <비교 주소>`: 두 페이지를 같은 화면 크기와 스크롤 위치에서 찍어 `test-results/about-compare/`에 저장합니다. 기준 시안은 `on-the-book-brand` 폴더에서 `npm run dev`로 띄운 `http://127.0.0.1:4380/sample-02/`이고, 비교 대상은 `npm run build` 뒤 `npm start`로 띄운 `http://127.0.0.1:4173/client/about/`입니다. 쌍마다 SSIM은 Git Bash에서 다음 명령으로 구하며, 모션을 끈 상태의 움직임 없는 구간(`3-experience`, `4-scenes`, `5-film`, `6-footer`)은 0.97 이상이어야 합니다.

```bash
(cd test-results/about-compare && for ref in *-reference.png; do name="${ref%-reference.png}"; printf "%-34s %s\n" "$name" "$(ffmpeg -hide_banner -i "$ref" -i "$name-candidate.png" -lavfi ssim -f null - 2>&1 | grep -oE 'All:[0-9.]+' | cut -d: -f2)"; done)
```

## 시안 비교 결과(2026-09-23)

기준 `http://127.0.0.1:4380/sample-02/`, 비교 `http://127.0.0.1:4335/client/about/`(완성본)을 1440×900, 390×844에서 모션 켜짐·꺼짐으로 찍었습니다.

| 위치 | 데스크톱 켜짐 | 데스크톱 꺼짐 | 휴대폰 켜짐 | 휴대폰 꺼짐 |
| --- | --- | --- | --- | --- |
| 1-hero | 0.995 | 0.997 | 0.993 | 1.000 |
| 2-world-1 | 0.992 | — | 1.000 | — |
| 2-world-2 | 1.000 | — | 1.000 | — |
| 2-world-3 | 1.000 | — | 1.000 | — |
| 2-world | — | 1.000 | — | 1.000 |
| 3-experience | 1.000 | 1.000 | 1.000 | 1.000 |
| 4-scenes | 0.998 | 0.998 | 0.998 | 0.998 |
| 5-film | 0.997 | 1.000 | 0.997 | 1.000 |
| 6-footer | 1.000 | 1.000 | 1.000 | 1.000 |

- 시간에 따른 차이: `1-hero`(데스크톱 켜짐, SSIM 0.995)는 첫 화면의 3D 책·정원이 계속 유휴 움직이고 있어 두 캡처의 애니메이션 위상이 달라 책과 정원 테두리 부근에 옅은 차이가 남습니다(책 색 순환에 해당). 모션을 꺼도 데스크톱에서는 완전히 같아지지는 않아(SSIM 0.997) 책 색 순환은 모션 설정과 무관하게 계속되는 것으로 보입니다. `2-world-1`(데스크톱 켜짐, SSIM 0.992)은 점토 길이 막 로드된 직후에 찍혀, 캔버스와 정지 이미지의 0.7초 교차 페이드가 끝나기 전의 차이가 사진 카드 주변에 남았습니다. 점토 길은 스크롤할 때만 다시 그리므로 사진이 스스로 움직이지는 않으며, 최종 리뷰에서 같은 위치를 1초·3초 뒤에 다시 찍었을 때는 SSIM 1.000으로 같았습니다. `5-film`(데스크톱 켜짐, SSIM 0.997)은 재생 버튼을 감싸는 회전 문구 'A WORLD BETWEEN THE WORDS · PRESS TO PLAY'의 회전 각도만 다르고 나머지 픽셀은 완전히 같으며, 모션을 끄면 회전이 멈춰 SSIM 1.000이 됩니다. 이 구간들 모두 배치·문구·색 구성 자체는 두 화면에서 동일했습니다.
- 변환에 따른 차이: `4-scenes`는 모션 켜짐·꺼짐과 관계없이 데스크톱 SSIM 0.998(0.997782), 휴대폰 SSIM 0.998(0.998463)로 같은 값이 나옵니다. 애니메이션이 아니라 장면 카드 이미지를 PNG에서 WebP(품질 90)로 바꾸며 생긴 인코딩 차이이며, 위 "시안과 달라진 점"에 기록한 의도된 변경입니다. 눈으로 본 배치·문구·색 차이는 없었습니다.
- 차이가 없었던 구간: `2-world-2`, `2-world-3`, `6-footer`는 데스크톱 켜짐에서 SSIM 1.000으로 두 화면이 픽셀 단위까지 같았습니다. `3-experience`(데스크톱 켜짐)는 SSIM 0.999932로 반올림하면 1.000이지만 글자 가장자리와 사진 테두리에 아주 옅은 안티에일리어싱 차이가 있으며, 눈으로 본 배치·문구·색 차이는 없었습니다. 모션을 끈 상태에서는 `2-world`, `3-experience`, `5-film`, `6-footer`가 데스크톱·휴대폰 모두 SSIM 1.000이었고, `1-hero`도 휴대폰에서는 SSIM 1.000이었습니다.
