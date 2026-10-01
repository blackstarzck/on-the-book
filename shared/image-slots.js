// The frames readers see each studio picture in, so the studio can show an upload the way readers will get it.
// The reader's CSS draws the frames (client/landing.css, client/detail.css); tests/studio-previews.mjs measures the
// published pictures against this table, so a frame changed on one side fails there until the other side follows.
// `ratio` is width / height at the reader width in `viewport`. `position` is the point a crop keeps.
// Separate PC/mobile hero artwork uses fixed ratios. heroFocus is retained for legacy crop previews.
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
  // Banners may already contain text, so these previews show the artwork without a scrim.
  hero: [
    { id: "wide", label: "PC", ratio: 2784 / 800, ratioLabel: "87:25", viewport: 1440, position: "50% 50%" },
    { id: "tablet", label: "태블릿", ratio: 2784 / 800, ratioLabel: "87:25", viewport: 768, position: "50% 50%" },
  ],
  heroMobile: [
    { id: "phone", label: "모바일", ratio: 654 / 720, ratioLabel: "109:120", viewport: 390, position: "50% 50%" },
  ],
};
