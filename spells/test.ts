import { DrawWriteable } from '../util/Drawable';
import { Texture } from './Texture';

export const enum AutotileKind {
  /** Doesn't perform autotiling. */
  NONE = 0,

  /**
   * Tiles sit at their expected position.
   * Autotiling is enabled.
   * 
   * Requires 3x3 bitmaps, where the center bit is ignored. Each of the 8
   * surrounding bits represents the state of the 8 neighboring tiles.
   * Needs 48 tiles to cover all cases.
  */
  NORMAL,

  /**
   * Tile images sit at the intersection between four neighboring tiles.
   * Autotiling is enabled.
   * 
   * Requires 2x2 bitmaps, which dictate the states of the 4 neighbor tiles.
   * Needs only 16 tiles to cover all cases.
   */
  CENTER,
}

/**
 * A set of tiles loaded from an image, including their matching bitmap.
 * 
 * For each tile, the corresponding bitmap should be either
 * 2x2 or 3x3 pixels in size (depending on the tileset mode).
 */
export class TileSet {
  private totalTilesX: number;
  private totalTilesY: number;

  /**
   * Constructs a tileset
   * @param texture The texture used by the tileset
   * @param tileWidth How wide a single tile is (in pixels)
   * @param tileHeight How tall a single tile is (in pixels)
   */
  public constructor(
    texture: Texture,
    tileWidth: number,
    tileHeight: number,
  );
  /**
   * Constructs a tileset
   * @param texture The texture used by the tileset
   * @param tileWidth How wide a single tile is (in pixels)
   * @param tileHeight How tall a single tile is (in pixels)
   * @param kind The kind of tileset used
   * @param bitmap The bitmap used for autotiling the tileset
   */
  public constructor(
    texture: Texture,
    tileWidth: number,
    tileHeight: number,
    kind: AutotileKind,
    bitmap: Texture,
  );

  /**
   * Constructs a tileset
   * @param texture The texture used by the tileset
   * @param tileWidth How wide a single tile is (in pixels)
   * @param tileHeight How tall a single tile is (in pixels)
   * @param kind The kind of tileset used
   * @param bitmap The bitmap used for autotiling the tileset
   */
  public constructor(
    public texture: Texture,
    public tileWidth: number,
    public tileHeight: number,
    public autotileKind: AutotileKind = AutotileKind.NONE,
    public bitmap?: Texture,
  ) {

    const textureWidth = texture.getWidth();
    const textureHeight = texture.getHeight();
    if (textureWidth === 0 || textureHeight === 0) {
      throw new Error('TileSet texture not loaded!');
    }

    const totalTilesX = this.totalTilesX = textureWidth  / tileWidth;
    const totalTilesY = this.totalTilesY = textureHeight / tileHeight;
    if (totalTilesX !== ~~totalTilesX || totalTilesY !== ~~totalTilesY) {
      throw new Error('Tileset size doesn\'t match the individual tile sizes!');
    }

    if (autotileKind !== undefined && bitmap !== undefined) {
      const bitmapTileSize =
        autotileKind === AutotileKind.NORMAL ? 3 :
          autotileKind === AutotileKind.CENTER ? 2 :
            0;
      if (bitmapTileSize !== 0) {
        const bitmapWidth = bitmap.getWidth();
        const bitmapHeight = bitmap.getHeight();
        if (bitmapWidth === 0 || bitmapHeight === 0) {
          throw new Error('Bitmap texture not loaded!');
        }
        if (
          bitmap.getWidth() !== totalTilesX * bitmapTileSize ||
          bitmap.getHeight() !== totalTilesY * bitmapTileSize
        ) {
          throw new Error('Bitmap doesn\'t match expected size!');
        }
      }
    }
  }

  /** Draws a tile from this tileset onto a given source */
  public drawTile(
    tile: number, x: number, y: number,
    destination: DrawWriteable,
  ) {
    // TODO: check with debugger if this is in range
    const sx = tile % this.totalTilesX;
    const sy = ~~(tile / this.totalTilesX);
    this.texture.draw(
      sx * this.tileWidth, sy * this.tileHeight,
      this.tileWidth, this.tileHeight,
      x, y,
      this.tileWidth, this.tileHeight,
      destination
    );
  }
}
