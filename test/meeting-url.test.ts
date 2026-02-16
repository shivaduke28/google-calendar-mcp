import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { meetingUrlPatterns } from "../src/meeting-url.js";

describe("meetingUrlPatterns", () => {
  describe("zoom", () => {
    it("基本的なZoom URL", () => {
      const m = "https://zoom.us/j/1234567890".match(meetingUrlPatterns.zoom);
      assert.equal(m?.[0], "https://zoom.us/j/1234567890");
    });

    it("パスワード付きZoom URL", () => {
      const m = "https://zoom.us/j/1234567890?pwd=abcDEF123".match(meetingUrlPatterns.zoom);
      assert.equal(m?.[0], "https://zoom.us/j/1234567890?pwd=abcDEF123");
    });

    it("サブドメイン付きZoom URL", () => {
      const m = "https://us02web.zoom.us/j/9876543210".match(meetingUrlPatterns.zoom);
      assert.equal(m?.[0], "https://us02web.zoom.us/j/9876543210");
    });

    it("会社サブドメイン付きZoom URL", () => {
      const m = "https://company.zoom.us/j/1111111111".match(meetingUrlPatterns.zoom);
      assert.equal(m?.[0], "https://company.zoom.us/j/1111111111");
    });

    it("テキスト中のZoom URL", () => {
      const m = "会議はこちら https://zoom.us/j/1234567890 から参加".match(meetingUrlPatterns.zoom);
      assert.equal(m?.[0], "https://zoom.us/j/1234567890");
    });

    it("Zoom以外のURLにはマッチしない", () => {
      const m = "https://example.com/zoom".match(meetingUrlPatterns.zoom);
      assert.equal(m, null);
    });
  });

  describe("teams", () => {
    it("基本的なTeams URL", () => {
      const m = "https://teams.microsoft.com/meet/user@example.com/1234".match(meetingUrlPatterns.teams);
      assert.equal(m?.[0], "https://teams.microsoft.com/meet/user@example.com/1234");
    });

    it("テキスト中のTeams URL", () => {
      const m = "参加リンク: https://teams.microsoft.com/meet/abc123 です".match(meetingUrlPatterns.teams);
      assert.equal(m?.[0], "https://teams.microsoft.com/meet/abc123");
    });

    it("Teams以外のURLにはマッチしない", () => {
      const m = "https://teams.microsoft.com/other/path".match(meetingUrlPatterns.teams);
      assert.equal(m, null);
    });
  });

  describe("meet", () => {
    it("基本的なMeet URL", () => {
      const m = "https://meet.google.com/abc-defg-hij".match(meetingUrlPatterns.meet);
      assert.equal(m?.[0], "https://meet.google.com/abc-defg-hij");
    });

    it("テキスト中のMeet URL", () => {
      const m = "Google Meet: https://meet.google.com/xyz-abcd-efg にて".match(meetingUrlPatterns.meet);
      assert.equal(m?.[0], "https://meet.google.com/xyz-abcd-efg");
    });

    it("形式が違うMeet URLにはマッチしない", () => {
      const m = "https://meet.google.com/12345".match(meetingUrlPatterns.meet);
      assert.equal(m, null);
    });
  });
});
