// The frames readers see each studio picture in, so the studio can show an upload the way readers will get it.
// The reader's CSS draws the frames (client/landing.css, client/detail.css); tests/studio-previews.mjs measures the
// published pictures against this table, so a frame changed on one side fails there until the other side follows.
// `ratio` is width / height at the reader width in `viewport`. The hero card follows the window, so it has one entry
// per typical width. `position` is the CSS object-position, the point a crop keeps; hero photos take theirs from the
// slide's focus instead.
export const heroFocus = { left: "18% 50%", center: "50% 50%", right: "82% 50%" };

export const imageSlots = {
  cover: [
    { id: "shelf", label: "책장·작품 상세", ratio: 2 / 2.85, ratioLabel: "2:2.85", position: "50% 50%", viewport: 1440 },
  ],
  // 도서 메인 썸네일: the scene previews' big tile, which lays the book title over its bottom.
  bookThumbnail: [
    { id: "scene", label: "홈 장면 섹션", ratio: 1, ratioLabel: "1:1", position: "50% 50%", viewport: 1440, title: true },
    { id: "scene-phone", label: "홈 장면 섹션 · 휴대폰", ratio: 16 / 9, ratioLabel: "16:9", position: "50% 50%", viewport: 390, title: true },
  ],
  chapterThumbnail: [
    { id: "card", label: "홈 장면 카드", ratio: 1, ratioLabel: "1:1", position: "50% 50%", viewport: 1440 },
    { id: "panel", label: "작품 상세 장면 패널", ratio: 16 / 10, ratioLabel: "16:10", position: "50% 50%", viewport: 1440 },
  ],
  // A photo slide darkens the side its white copy sits on: the left, or the bottom on phones.
  hero: [
    { id: "wide", label: "넓은 화면", ratio: 1200 / 354, ratioLabel: "약 3.4:1", viewport: 1440, scrim: "left" },
    { id: "tablet", label: "태블릿", ratio: 720 / 330, ratioLabel: "약 2.2:1", viewport: 768, scrim: "left" },
    { id: "phone", label: "휴대폰", ratio: 350 / 392, ratioLabel: "약 0.9:1", viewport: 390, scrim: "bottom" },
  ],
};
