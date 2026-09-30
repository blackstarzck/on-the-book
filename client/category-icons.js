// The clay icons of the bookshelf's quick menu. A category shows its own icon only when one is drawn for its name
// (판타지, 모험); any other category falls back to the open book, as does a hero slide without a photo. The studio's
// book form shows the same pick beside the category it is typed into.
import openBookClay from "./assets/quick-menu/open-book-clay.png";
import fantasySparklesClay from "./assets/quick-menu/fantasy-sparkles-clay.png";
import adventureMapClay from "./assets/quick-menu/adventure-map-clay.png";
import bookmarkClay from "./assets/quick-menu/bookmark-clay.png";
import sceneLayersClay from "./assets/quick-menu/scene-layers-clay.png";
import helpClay from "./assets/quick-menu/help-clay.png";

const quickIcons = {
  all: openBookClay,
  판타지: fantasySparklesClay,
  모험: adventureMapClay,
  reading: bookmarkClay,
  scenes: sceneLayersClay,
  help: helpClay,
};

// Categories are typed in the studio, so names such as "constructor" must not reach Object.prototype.
export const iconFor = (name) => (Object.hasOwn(quickIcons, name) ? quickIcons[name] : openBookClay);
