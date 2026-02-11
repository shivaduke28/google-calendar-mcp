import { describe, it, expect } from "bun:test";
import {
  classifyAttendees,
  checkPermission,
  denyMessage,
  loadPermissionConfig,
  PermissionAction,
  AttendeeCondition,
  type PermissionConfig,
} from "../src/permissions.js";

const SELF = "me@example.com";
const DOMAIN = "example.com";

describe("classifyAttendees", () => {
  it("参加者なし → self_only", () => {
    expect(classifyAttendees([], SELF, DOMAIN)).toBe(AttendeeCondition.SelfOnly);
  });

  it("自分だけ → self_only", () => {
    expect(classifyAttendees(["me@example.com"], SELF, DOMAIN)).toBe(AttendeeCondition.SelfOnly);
  });

  it("自分（大文字小文字違い） → self_only", () => {
    expect(classifyAttendees(["Me@Example.COM"], SELF, DOMAIN)).toBe(AttendeeCondition.SelfOnly);
  });

  it("同じドメインのメンバー → internal", () => {
    expect(classifyAttendees(["me@example.com", "alice@example.com"], SELF, DOMAIN)).toBe(AttendeeCondition.Internal);
  });

  it("同じドメイン複数人 → internal", () => {
    expect(
      classifyAttendees(["me@example.com", "alice@example.com", "bob@example.com"], SELF, DOMAIN)
    ).toBe(AttendeeCondition.Internal);
  });

  it("外部ドメインの参加者 → external", () => {
    expect(classifyAttendees(["me@example.com", "alice@other.com"], SELF, DOMAIN)).toBe(AttendeeCondition.External);
  });

  it("内部と外部が混在 → external", () => {
    expect(
      classifyAttendees(["me@example.com", "alice@example.com", "bob@other.com"], SELF, DOMAIN)
    ).toBe(AttendeeCondition.External);
  });

  it("ドメイン未設定 → 他者がいれば external", () => {
    expect(classifyAttendees(["me@example.com", "alice@example.com"], SELF, "")).toBe(AttendeeCondition.External);
  });
});

describe("checkPermission", () => {
  const config: PermissionConfig = {
    internalDomain: "example.com",
    permissions: {
      read: PermissionAction.Allow,
      create: PermissionAction.Allow,
      update: {
        self_only: PermissionAction.Allow,
        internal: PermissionAction.Allow,
        external: PermissionAction.Deny,
      },
      delete: {
        self_only: PermissionAction.Allow,
        internal: PermissionAction.Deny,
        external: PermissionAction.Deny,
      },
    },
  };

  it("read → allow", () => {
    const result = checkPermission(config, "read", [], SELF);
    expect(result.action).toBe(PermissionAction.Allow);
    expect(result.condition).toBe(AttendeeCondition.SelfOnly);
  });

  it("create → allow", () => {
    const result = checkPermission(config, "create", [], SELF);
    expect(result.action).toBe(PermissionAction.Allow);
  });

  it("update self_only → allow", () => {
    const result = checkPermission(config, "update", ["me@example.com"], SELF);
    expect(result.action).toBe(PermissionAction.Allow);
    expect(result.condition).toBe(AttendeeCondition.SelfOnly);
  });

  it("update internal → allow", () => {
    const result = checkPermission(config, "update", ["me@example.com", "alice@example.com"], SELF);
    expect(result.action).toBe(PermissionAction.Allow);
    expect(result.condition).toBe(AttendeeCondition.Internal);
  });

  it("update external → deny", () => {
    const result = checkPermission(config, "update", ["me@example.com", "alice@other.com"], SELF);
    expect(result.action).toBe(PermissionAction.Deny);
    expect(result.condition).toBe(AttendeeCondition.External);
  });

  it("delete self_only → allow", () => {
    const result = checkPermission(config, "delete", [], SELF);
    expect(result.action).toBe(PermissionAction.Allow);
    expect(result.condition).toBe(AttendeeCondition.SelfOnly);
  });

  it("delete internal → deny", () => {
    const result = checkPermission(config, "delete", ["me@example.com", "alice@example.com"], SELF);
    expect(result.action).toBe(PermissionAction.Deny);
    expect(result.condition).toBe(AttendeeCondition.Internal);
  });

  it("delete external → deny", () => {
    const result = checkPermission(config, "delete", ["me@example.com", "bob@other.com"], SELF);
    expect(result.action).toBe(PermissionAction.Deny);
    expect(result.condition).toBe(AttendeeCondition.External);
  });

  it("フラットなパーミッション（全操作同一設定）", () => {
    const flatConfig: PermissionConfig = {
      internalDomain: "",
      permissions: {
        read: PermissionAction.Allow,
        create: PermissionAction.Allow,
        update: PermissionAction.Deny,
        delete: PermissionAction.Deny,
      },
    };
    expect(checkPermission(flatConfig, "update", ["me@example.com", "alice@example.com"], SELF).action).toBe(PermissionAction.Deny);
    expect(checkPermission(flatConfig, "delete", [], SELF).action).toBe(PermissionAction.Deny);
  });
});

describe("denyMessage", () => {
  it("外部参加者のdelete", () => {
    expect(denyMessage("delete", AttendeeCondition.External)).toBe("外部参加者を含むイベントのdeleteは許可されていません。");
  });

  it("内部メンバーのupdate", () => {
    expect(denyMessage("update", AttendeeCondition.Internal)).toBe("内部メンバーを含むイベントのupdateは許可されていません。");
  });

  it("自分のみのdelete", () => {
    expect(denyMessage("delete", AttendeeCondition.SelfOnly)).toBe("自分のみを含むイベントのdeleteは許可されていません。");
  });
});

describe("loadPermissionConfig", () => {
  it("パスがundefinedならデフォルト設定", async () => {
    const config = await loadPermissionConfig(undefined);
    expect(config.internalDomain).toBe("");
    expect(config.permissions.read).toBe(PermissionAction.Allow);
    expect(config.permissions.update).toEqual({
      self_only: PermissionAction.Allow,
      internal: PermissionAction.Allow,
      external: PermissionAction.Deny,
    });
    expect(config.permissions.delete).toEqual({
      self_only: PermissionAction.Allow,
      internal: PermissionAction.Allow,
      external: PermissionAction.Deny,
    });
  });

  it("存在しないファイルならデフォルト設定", async () => {
    const config = await loadPermissionConfig("/nonexistent/path.json");
    expect(config.internalDomain).toBe("");
    expect(config.permissions.read).toBe(PermissionAction.Allow);
  });
});
