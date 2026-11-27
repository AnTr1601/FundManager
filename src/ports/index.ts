export * from "./repositories";
export * from "./services";
export * from "./storage";

import type {
  FundRepository,
  MemberRepository,
  TransactionRepository,
  AuditLogRepository,
  FundUnitOfWork,
} from "./repositories";
import type { Clock, IdGenerator, TokenGenerator } from "./services";
import type { StoragePort } from "./storage";

/** Tập hợp các cổng mà một adapter cung cấp; composition root trả về kiểu này. */
export interface AppPorts {
  funds: FundRepository;
  members: MemberRepository;
  transactions: TransactionRepository;
  auditLogs: AuditLogRepository;
  uow: FundUnitOfWork;
  storage: StoragePort;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
}
