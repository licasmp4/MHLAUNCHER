using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;

public static class Px {
  // imagem = int[w,h] ARGB; 0 = transparente
  public static int[,] Load(string p) {
    using (var b = new Bitmap(p)) {
      var r = new int[b.Width, b.Height];
      for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++) r[x, y] = b.GetPixel(x, y).ToArgb();
      return r;
    }
  }
  public static void Save(int[,] a, string p) {
    int w = a.GetLength(0), h = a.GetLength(1);
    using (var b = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) b.SetPixel(x, y, Color.FromArgb(a[x, y]));
      b.Save(p, ImageFormat.Png);
    }
  }
  public static void Preview(int[,] a, string p, int s, int bg) {
    int w = a.GetLength(0), h = a.GetLength(1);
    using (var b = new Bitmap(w * s, h * s, PixelFormat.Format32bppArgb))
    using (var g = Graphics.FromImage(b)) {
      g.Clear(Color.FromArgb(bg));
      for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if ((a[x, y] >> 24 & 255) > 0)
        using (var br = new SolidBrush(Color.FromArgb(a[x, y]))) g.FillRectangle(br, x * s, y * s, s, s);
      b.Save(p, ImageFormat.Png);
    }
  }
  static int R(int c) { return c >> 16 & 255; } static int G(int c) { return c >> 8 & 255; } static int B(int c) { return c & 255; }
  static int D(int a, int b) { int r = R(a) - R(b), g = G(a) - G(b), bb = B(a) - B(b); return 2 * r * r + 4 * g * g + 3 * bb * bb; }

  public static int[,] KeyBlack(int[,] a, int thr) {
    int w = a.GetLength(0), h = a.GetLength(1); var r = new int[w, h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { int c = a[x, y]; r[x, y] = (R(c) + G(c) + B(c) < thr) ? 0 : (c | unchecked((int)0xFF000000)); }
    return r;
  }
  public static int Nearest(int c, int[] pal) { int best = pal[0], bd = int.MaxValue; foreach (var p in pal) { int d = D(c, p); if (d < bd) { bd = d; best = p; } } return best; }
  public static int[,] Quantize(int[,] a, int[] pal) {
    int w = a.GetLength(0), h = a.GetLength(1); var r = new int[w, h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) r[x, y] = a[x, y] == 0 ? 0 : (Nearest(a[x, y], pal) | unchecked((int)0xFF000000));
    return r;
  }
  // k-means simples nas cores opacas, semente = as k cores mais frequentes depois de juntar as quase iguais
  public static int[] KMeans(int[,] a, int k) {
    var pts = new List<int>(); foreach (var c in a) if (c != 0) pts.Add(c);
    var cent = pts.GroupBy(c => ((R(c) >> 3) << 10) | ((G(c) >> 3) << 5) | (B(c) >> 3)).OrderByDescending(g => g.Count()).Select(g => g.First()).Take(k).ToArray();
    k = cent.Length;
    for (int it = 0; it < 30; it++) {
      var sr = new long[k]; var sg = new long[k]; var sb = new long[k]; var n = new int[k];
      foreach (var c in pts) { int bi = 0, bd = int.MaxValue; for (int i = 0; i < k; i++) { int d = D(c, cent[i]); if (d < bd) { bd = d; bi = i; } } sr[bi] += R(c); sg[bi] += G(c); sb[bi] += B(c); n[bi]++; }
      for (int i = 0; i < k; i++) if (n[i] > 0) cent[i] = unchecked((int)0xFF000000) | (int)(sr[i] / n[i]) << 16 | (int)(sg[i] / n[i]) << 8 | (int)(sb[i] / n[i]);
    }
    return cent;
  }
  public static string Hex(int c) { return string.Format("#{0:x2}{1:x2}{2:x2}", R(c), G(c), B(c)); }
  public static int FromHex(string s) { s = s.TrimStart('#'); return unchecked((int)0xFF000000) | Convert.ToInt32(s, 16); }

  public static int[,] Scale2x(int[,] a) {
    int w = a.GetLength(0), h = a.GetLength(1); var r = new int[w * 2, h * 2];
    Func<int, int, int> P = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : a[x, y];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      int E = a[x, y], B0 = P(x, y - 1), Dd = P(x - 1, y), F = P(x + 1, y), H = P(x, y + 1);
      int e0 = E, e1 = E, e2 = E, e3 = E;
      if (B0 != H && Dd != F) { e0 = Dd == B0 ? Dd : E; e1 = B0 == F ? F : E; e2 = Dd == H ? Dd : E; e3 = H == F ? F : E; }
      r[2 * x, 2 * y] = e0; r[2 * x + 1, 2 * y] = e1; r[2 * x, 2 * y + 1] = e2; r[2 * x + 1, 2 * y + 1] = e3;
    }
    return r;
  }
  // RotSprite: amplia 8x com Scale2x, gira com vizinho mais próximo e volta ao tamanho lendo o centro de cada bloco.
  // gira em volta de (px,py) da imagem original e coloca esse ponto em (ox,oy) de uma tela w x h
  public static int[,] Rot(int[,] a, double graus, double px, double py, int w, int h, double ox, double oy) {
    var big = Scale2x(Scale2x(Scale2x(a))); int bw = big.GetLength(0), bh = big.GetLength(1);
    double t = -graus * Math.PI / 180, c = Math.Cos(t), s = Math.Sin(t);
    var r = new int[w, h];
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      double dx = x + .5 - ox, dy = y + .5 - oy;
      double sx = (dx * c - dy * s + px) * 8, sy = (dx * s + dy * c + py) * 8;
      int ix = (int)Math.Floor(sx), iy = (int)Math.Floor(sy);
      r[x, y] = (ix < 0 || iy < 0 || ix >= bw || iy >= bh) ? 0 : big[ix, iy];
    }
    return r;
  }
  public static int[,] Blank(int w, int h) { return new int[w, h]; }
  public static void Blit(int[,] dst, int[,] src, int ox, int oy) {
    int w = src.GetLength(0), h = src.GetLength(1);
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) { int c = src[x, y]; int X = x + ox, Y = y + oy;
      if (c != 0 && X >= 0 && Y >= 0 && X < dst.GetLength(0) && Y < dst.GetLength(1)) dst[X, Y] = c; }
  }
  // pixels opacos sem nenhum vizinho opaco (8 direções)
  public static int Orphans(int[,] a) {
    int w = a.GetLength(0), h = a.GetLength(1), n = 0;
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) if (a[x, y] != 0) {
      bool viz = false; for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { if (i == 0 && j == 0) continue; int X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < w && Y < h && a[X, Y] != 0) viz = true; }
      if (!viz) n++; }
    return n;
  }
  public static string Dump(int[,] a, int[] pal, string chars) {
    int w = a.GetLength(0), h = a.GetLength(1); var sb = new System.Text.StringBuilder();
    for (int y = 0; y < h; y++) { for (int x = 0; x < w; x++) { int c = a[x, y]; if (c == 0) sb.Append('.'); else { int i = Array.IndexOf(pal, c); sb.Append(i >= 0 && i < chars.Length ? chars[i] : '?'); } } sb.AppendLine(); }
    return sb.ToString();
  }
}
