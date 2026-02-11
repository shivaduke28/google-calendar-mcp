import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    assert.equal(classifyAttendees([], SELF, DOMAIN), AttendeeCondition.SelfOnly);
  });

  it("自分だけ → self_only", () => {
    assert.equal(
      classifyAttendees(["me@example.com"], SELF, DOMAIN),
      AttendeeCondition.SelfOnly
    );
  });

  it("自分（大文字小文字違い） → self_only", () => {
    assert.equal(
      classifyAttendees(["Me@Example.COM"], SELF, DOMAIN),
      AttendeeCondition.SelfOnly
    );
  });

  it("同じドメインのメンバー → internal", () => {
    assert.equal(
      classifyAttendees(["me@example.com", "alice@example.com"], SELF, DOMAIN),
      AttendeeCondition.Internal
    );
  });

  it("同じドメイン複数人 → internal", () => {
    assert.equal(
      classifyAttendees(
        ["me@example.com", "alice@example.com", "bob@example.com"],
        SELF,
        DOMAIN
      ),
      AttendeeCondition.Internal
    );
  });

  it("外部ドメインの参加者 → external", () => {
    assert.equal(
      classifyAttendees(["me@example.com", "alice@other.com"], SELF, DOMAIN),
      AttendeeCondition.External
    );
  });

  it("内部と外部が混在 → external", () => {
    assert.equal(
      classifyAttendees(
        ["me@example.com", "alice@example.com", "bob@other.com"],
        SELF,
        DOMAIN
      ),
      AttendeeCondition.External
    );
  });

  it("ドメイン未設定 → 他者がいれば external", () => {
    assert.equal(
      classifyAttendees(["me@example.com", "alice@example.com"], SELF, ""),
      AttendeeCondition.External
    );
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
    assert.equal(result.action, PermissionAction.Allow);
    assert.equal(result.condition, AttendeeCondition.SelfOnly);
  });

  it("create → allow", () => {
    const result = checkPermission(config, "create", [], SELF);
    assert.equal(result.action, PermissionAction.Allow);
  });

  it("update self_only → allow", () => {
    const result = checkPermission(config, "update", ["me@example.com"], SELF);
    assert.equal(result.action, PermissionAction.Allow);
    assert.equal(result.condition, AttendeeCondition.SelfOnly);
  });

  it("update internal → allow", () => {
    const result = checkPermission(config, "update", ["me@example.com", "alice@example.com"], SELF);
    assert.equal(result.action, PermissionAction.Allow);
    assert.equal(result.condition, AttendeeCondition.Internal);
  });

  it("update external → deny", () => {
    const result = checkPermission(config, "update", ["me@example.com", "alice@other.com"], SELF);
    assert.equal(result.action, PermissionAction.Deny);
    assert.equal(result.condition, AttendeeCondition.External);
  });

  it("delete self_only → allow", () => {
    const result = checkPermission(config, "delete", [], SELF);
    assert.equal(result.action, PermissionAction.Allow);
    assert.equal(result.condition, AttendeeCondition.SelfOnly);
  });

  it("delete internal → deny", () => {
    const result = checkPermission(config, "delete", ["me@example.com", "alice@example.com"], SELF);
    assert.equal(result.action, PermissionAction.Deny);
    assert.equal(result.condition, AttendeeCondition.Internal);
  });

  it("delete external → deny", () => {
    const result = checkPermission(config, "delete", ["me@example.com", "bob@other.com"], SELF);
    assert.equal(result.action, PermissionAction.Deny);
    assert.equal(result.condition, AttendeeCondition.External);
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
    assert.equal(
      checkPermission(flatConfig, "update", ["me@example.com", "alice@example.com"], SELF).action,
      PermissionAction.Deny
    );
    assert.equal(
      checkPermission(flatConfig, "delete", [], SELF).action,
      PermissionAction.Deny
    );
  });
});

describe("denyMessage", () => {
  it("外部参加者のdelete", () => {
    assert.equal(
      denyMessage("delete", AttendeeCondition.External),
      "外部参加者を含むイベントのdeleteは許可されていません。"
    );
  });

  it("内部メンバーのupdate", () => {
    assert.equal(
      denyMessage("update", AttendeeCondition.Internal),
      "内部メンバーを含むイベントのupdateは許可されていません。"
    );
  });

  it("自分のみのdelete", () => {
    assert.equal(
      denyMessage("delete", AttendeeCondition.SelfOnly),
      "自分のみを含むイベントのdeleteは許可されていません。"
    );
  });
});

describe("loadPermissionConfig", () => {
  it("パスがundefinedならデフォルト設定", async () => {
    const config = await loadPermissionConfig(undefined);
    assert.equal(config.internalDomain, "");
    assert.equal(config.permissions.read, PermissionAction.Allow);
    assert.equal(config.permissions.update, PermissionAction.Allow);
    assert.equal(config.permissions.delete, PermissionAction.Allow);
  });

  it("存在しないファイルならデフォルト設定", async () => {
    const config = await loadPermissionConfig("/nonexistent/path.json");
    assert.equal(config.internalDomain, "");
    assert.equal(config.permissions.read, PermissionAction.Allow);
  });
});
