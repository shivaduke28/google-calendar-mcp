import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

export const PermissionAction = {
  Allow: "allow",
  Deny: "deny",
} as const;

export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const OperationType = {
  Read: "read",
  Create: "create",
  Update: "update",
  Delete: "delete",
} as const;

export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface ConditionalPermission {
  self_only: PermissionAction;
  internal: PermissionAction;
  external: PermissionAction;
}

export interface PermissionConfig {
  internalDomain: string;
  permissions: {
    read: ConditionalPermission;
    create: ConditionalPermission;
    update: ConditionalPermission;
    delete: ConditionalPermission;
  };
}

const DEFAULT_CONFIG: PermissionConfig = {
  internalDomain: "",
  permissions: {
    read: {
      self_only: PermissionAction.Allow,
      internal: PermissionAction.Allow,
      external: PermissionAction.Allow,
    },
    create: {
      self_only: PermissionAction.Allow,
      internal: PermissionAction.Allow,
      external: PermissionAction.Deny,
    },
    update: {
      self_only: PermissionAction.Allow,
      internal: PermissionAction.Allow,
      external: PermissionAction.Deny,
    },
    delete: {
      self_only: PermissionAction.Allow,
      internal: PermissionAction.Allow,
      external: PermissionAction.Deny,
    },
  },
};

export async function loadPermissionConfig(
  configPath: string | undefined
): Promise<PermissionConfig> {
  if (!configPath) return DEFAULT_CONFIG;

  // ファイルがなければデフォルト設定を書き出す
  if (!existsSync(configPath)) {
    try {
      await mkdir(dirname(configPath), { recursive: true });
      await writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
      console.error(`permissions.json を作成しました: ${configPath}`);
    } catch {
      console.error(`permissions.json の作成に失敗しました: ${configPath}`);
    }
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(content) as Partial<PermissionConfig>;
    return {
      internalDomain: parsed.internalDomain ?? DEFAULT_CONFIG.internalDomain,
      permissions: {
        read: parsed.permissions?.read ?? DEFAULT_CONFIG.permissions.read,
        create: parsed.permissions?.create ?? DEFAULT_CONFIG.permissions.create,
        update: parsed.permissions?.update ?? DEFAULT_CONFIG.permissions.update,
        delete: parsed.permissions?.delete ?? DEFAULT_CONFIG.permissions.delete,
      },
    };
  } catch {
    console.error(`設定ファイルの読み込みに失敗しました: ${configPath}`);
    return DEFAULT_CONFIG;
  }
}

export const AttendeeCondition = {
  SelfOnly: "self_only",
  Internal: "internal",
  External: "external",
} as const;

type AttendeeCondition = (typeof AttendeeCondition)[keyof typeof AttendeeCondition];

export function classifyAttendees(
  attendees: string[],
  selfEmail: string,
  internalDomain: string
): AttendeeCondition {
  const others = attendees.filter(
    (email) => email.toLowerCase() !== selfEmail.toLowerCase()
  );

  if (others.length === 0) return AttendeeCondition.SelfOnly;

  if (internalDomain && others.every((email) => email.toLowerCase().endsWith(`@${internalDomain.toLowerCase()}`))) {
    return AttendeeCondition.Internal;
  }

  return AttendeeCondition.External;
}

export interface PermissionCheckResult {
  action: PermissionAction;
  condition: AttendeeCondition;
}

export function checkPermission(
  config: PermissionConfig,
  operation: OperationType,
  attendees: string[],
  selfEmail: string
): PermissionCheckResult {
  const perm = config.permissions[operation];
  const condition = classifyAttendees(attendees, selfEmail, config.internalDomain);

  return { action: perm[condition], condition };
}

const CONDITION_LABELS: Record<AttendeeCondition, string> = {
  [AttendeeCondition.SelfOnly]: "自分のみ",
  [AttendeeCondition.Internal]: "内部メンバー",
  [AttendeeCondition.External]: "外部参加者",
};

export function denyMessage(operation: OperationType, condition: AttendeeCondition): string {
  return `${CONDITION_LABELS[condition]}を含むイベントの${operation}は許可されていません。`;
}
