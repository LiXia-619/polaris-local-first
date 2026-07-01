import Capacitor
import Foundation
import SQLite3

private let localDataSqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

@objc(LocalDataSqlitePlugin)
public class LocalDataSqlitePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalDataSqlitePlugin"
    public let jsName = "LocalDataSqlite"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "execute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise)
    ]

    private let sqliteQueue = DispatchQueue(label: "com.polaris.localData.sqlite", qos: .userInitiated)
    private var database: OpaquePointer?

    private let createEntriesTableSql = """
    CREATE TABLE IF NOT EXISTS local_data_entries (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
    """
    private let readEntrySql = """
    SELECT value_json
    FROM local_data_entries
    WHERE key = ?
    LIMIT 1
    """
    private let listKeysWithPrefixSql = """
    SELECT key
    FROM local_data_entries
    WHERE substr(key, 1, ?) = ?
    """
    private let upsertEntrySql = """
    INSERT INTO local_data_entries (key, value_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
    """
    private let deleteEntrySql = """
    DELETE FROM local_data_entries
    WHERE key = ?
    """
    private let createChatConversationTableSql = """
    CREATE TABLE IF NOT EXISTS chat_conversation (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      collaborator_id TEXT,
      group_room_id TEXT,
      active_project_id TEXT,
      pinned_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      metadata_json TEXT NOT NULL
    )
    """
    private let createChatMessageTableSql = """
    CREATE TABLE IF NOT EXISTS chat_message (
      id TEXT PRIMARY KEY NOT NULL,
      conversation_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES chat_conversation(id) ON DELETE CASCADE,
      UNIQUE(conversation_id, seq)
    )
    """
    private let createChatConversationUpdatedIndexSql = """
    CREATE INDEX IF NOT EXISTS idx_chat_conversation_updated_at
    ON chat_conversation(updated_at DESC, id ASC)
    """
    private let createChatMessageConversationSeqIndexSql = """
    CREATE INDEX IF NOT EXISTS idx_chat_message_conversation_seq
    ON chat_message(conversation_id, seq)
    """
    private let upsertChatConversationSql = """
    INSERT INTO chat_conversation (
      id,
      title,
      kind,
      collaborator_id,
      group_room_id,
      active_project_id,
      pinned_at,
      created_at,
      updated_at,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      kind = excluded.kind,
      collaborator_id = excluded.collaborator_id,
      group_room_id = excluded.group_room_id,
      active_project_id = excluded.active_project_id,
      pinned_at = excluded.pinned_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      metadata_json = excluded.metadata_json
    """
    private let deleteChatConversationMessagesSql = """
    DELETE FROM chat_message
    WHERE conversation_id = ?
    """
    private let upsertChatMessageSql = """
    INSERT INTO chat_message (
      id,
      conversation_id,
      seq,
      role,
      content,
      reasoning,
      created_at,
      updated_at,
      payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      conversation_id = excluded.conversation_id,
      seq = excluded.seq,
      role = excluded.role,
      content = excluded.content,
      reasoning = excluded.reasoning,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      payload_json = excluded.payload_json
    """
    private let readChatConversationSummariesSql = """
    SELECT
      c.id,
      c.title,
      c.kind,
      c.collaborator_id,
      c.group_room_id,
      c.active_project_id,
      c.pinned_at,
      c.created_at,
      c.updated_at,
      COUNT(m.id) AS message_count,
      COALESCE(MAX(m.updated_at), 0) AS latest_message_timestamp
    FROM chat_conversation c
    LEFT JOIN chat_message m ON m.conversation_id = c.id
    GROUP BY
      c.id,
      c.title,
      c.kind,
      c.collaborator_id,
      c.group_room_id,
      c.active_project_id,
      c.pinned_at,
      c.created_at,
      c.updated_at
    ORDER BY c.updated_at DESC, c.id ASC
    """
    private let readChatConversationExistsSql = """
    SELECT id
    FROM chat_conversation
    WHERE id = ?
    LIMIT 1
    """
    private let readChatConversationMetadataSql = """
    SELECT metadata_json
    FROM chat_conversation
    WHERE id = ?
    LIMIT 1
    """
    private let readChatMessageCountSql = """
    SELECT COUNT(*) AS message_count
    FROM chat_message
    WHERE conversation_id = ?
    """
    private let readRecentChatMessagesSql = """
    SELECT seq, payload_json
    FROM chat_message
    WHERE conversation_id = ?
    ORDER BY seq DESC
    LIMIT ?
    """
    private let readChatMessagesBeforeSeqSql = """
    SELECT seq, payload_json
    FROM chat_message
    WHERE conversation_id = ? AND seq < ?
    ORDER BY seq DESC
    LIMIT ?
    """

    deinit {
        if let database {
            sqlite3_close(database)
        }
    }

    @objc public func execute(_ call: CAPPluginCall) {
        guard let sql = call.getString("sql") else {
            call.reject("缺少 LocalData SQLite SQL。")
            return
        }
        let params = readParams(call)

        sqliteQueue.async {
            do {
                let normalizedSql = self.normalizeSql(sql)
                guard self.allowedExecuteSql().contains(normalizedSql) else {
                    throw LocalDataSqliteError.disallowedSql
                }
                let database = try self.openDatabase()
                try self.runStatement(database: database, sql: sql, params: params)
                DispatchQueue.main.async {
                    call.resolve()
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject(self.failureMessage("执行 LocalData SQLite 写入失败", error), nil, error)
                }
            }
        }
    }

    @objc public func query(_ call: CAPPluginCall) {
        guard let sql = call.getString("sql") else {
            call.reject("缺少 LocalData SQLite SQL。")
            return
        }
        let params = readParams(call)

        sqliteQueue.async {
            do {
                guard self.allowedQuerySql().contains(self.normalizeSql(sql)) else {
                    throw LocalDataSqliteError.disallowedSql
                }
                let database = try self.openDatabase()
                let rows = try self.runQuery(database: database, sql: sql, params: params)
                DispatchQueue.main.async {
                    call.resolve(["rows": rows])
                }
            } catch {
                DispatchQueue.main.async {
                    call.reject(self.failureMessage("执行 LocalData SQLite 读取失败", error), nil, error)
                }
            }
        }
    }

    private func allowedExecuteSql() -> Set<String> {
        [
            normalizeSql(createEntriesTableSql),
            normalizeSql(createChatConversationTableSql),
            normalizeSql(createChatMessageTableSql),
            normalizeSql(createChatConversationUpdatedIndexSql),
            normalizeSql(createChatMessageConversationSeqIndexSql),
            "BEGIN IMMEDIATE",
            "COMMIT",
            "ROLLBACK",
            normalizeSql(upsertEntrySql),
            normalizeSql(deleteEntrySql),
            normalizeSql(upsertChatConversationSql),
            normalizeSql(deleteChatConversationMessagesSql),
            normalizeSql(upsertChatMessageSql)
        ]
    }

    private func allowedQuerySql() -> Set<String> {
        [
            normalizeSql(readEntrySql),
            normalizeSql(listKeysWithPrefixSql),
            normalizeSql(readChatConversationSummariesSql),
            normalizeSql(readChatConversationExistsSql),
            normalizeSql(readChatConversationMetadataSql),
            normalizeSql(readChatMessageCountSql),
            normalizeSql(readRecentChatMessagesSql),
            normalizeSql(readChatMessagesBeforeSeqSql)
        ]
    }

    private func readParams(_ call: CAPPluginCall) -> [Any] {
        guard let params = call.options["params"] as? [Any] else {
            return []
        }
        return params
    }

    private func openDatabase() throws -> OpaquePointer {
        if let database {
            return database
        }

        let directory = try databaseDirectory()
        let url = directory.appendingPathComponent("local-data.sqlite3")
        var openedDatabase: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(url.path, &openedDatabase, flags, nil) == SQLITE_OK,
              let openedDatabase else {
            let message = openedDatabase.map { sqliteErrorMessage($0) } ?? "unknown sqlite open failure"
            if let openedDatabase {
                sqlite3_close(openedDatabase)
            }
            throw LocalDataSqliteError.sqlite(message)
        }

        database = openedDatabase
        return openedDatabase
    }

    private func databaseDirectory() throws -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let directory = base.appendingPathComponent("PolarisLocalDataSqlite", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func runStatement(database: OpaquePointer, sql: String, params: [Any]) throws {
        var statement: OpaquePointer?
        try prepare(database: database, sql: sql, statement: &statement)
        defer {
            sqlite3_finalize(statement)
        }
        try bind(params: params, statement: statement)
        let result = sqlite3_step(statement)
        guard result == SQLITE_DONE else {
            throw LocalDataSqliteError.sqlite(sqliteErrorMessage(database))
        }
    }

    private func runQuery(database: OpaquePointer, sql: String, params: [Any]) throws -> [[String: Any]] {
        var statement: OpaquePointer?
        try prepare(database: database, sql: sql, statement: &statement)
        defer {
            sqlite3_finalize(statement)
        }
        try bind(params: params, statement: statement)

        var rows: [[String: Any]] = []
        while true {
            let result = sqlite3_step(statement)
            if result == SQLITE_DONE {
                return rows
            }
            guard result == SQLITE_ROW else {
                throw LocalDataSqliteError.sqlite(sqliteErrorMessage(database))
            }

            var row: [String: Any] = [:]
            for index in 0..<sqlite3_column_count(statement) {
                guard let namePointer = sqlite3_column_name(statement, index) else {
                    continue
                }
                let name = String(cString: namePointer)
                row[name] = sqliteColumnValue(statement: statement, index: index)
            }
            rows.append(row)
        }
    }

    private func prepare(database: OpaquePointer, sql: String, statement: inout OpaquePointer?) throws {
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
            throw LocalDataSqliteError.sqlite(sqliteErrorMessage(database))
        }
    }

    private func bind(params: [Any], statement: OpaquePointer?) throws {
        for (offset, value) in params.enumerated() {
            let index = Int32(offset + 1)
            if value is NSNull {
                sqlite3_bind_null(statement, index)
                continue
            }
            if let stringValue = value as? String {
                sqlite3_bind_text(statement, index, stringValue, -1, localDataSqliteTransient)
                continue
            }
            if let boolValue = value as? Bool {
                sqlite3_bind_int(statement, index, boolValue ? 1 : 0)
                continue
            }
            if let intValue = value as? Int {
                sqlite3_bind_int64(statement, index, sqlite3_int64(intValue))
                continue
            }
            if let int64Value = value as? Int64 {
                sqlite3_bind_int64(statement, index, sqlite3_int64(int64Value))
                continue
            }
            if let doubleValue = value as? Double {
                sqlite3_bind_double(statement, index, doubleValue)
                continue
            }
            if let numberValue = value as? NSNumber {
                sqlite3_bind_double(statement, index, numberValue.doubleValue)
                continue
            }
            throw LocalDataSqliteError.invalidParams
        }
    }

    private func sqliteColumnValue(statement: OpaquePointer?, index: Int32) -> Any {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER:
            return NSNumber(value: sqlite3_column_int64(statement, index))
        case SQLITE_FLOAT:
            return NSNumber(value: sqlite3_column_double(statement, index))
        case SQLITE_TEXT:
            guard let textPointer = sqlite3_column_text(statement, index) else {
                return ""
            }
            return String(cString: textPointer)
        case SQLITE_NULL:
            return NSNull()
        case SQLITE_BLOB:
            let byteCount = Int(sqlite3_column_bytes(statement, index))
            guard let bytes = sqlite3_column_blob(statement, index), byteCount > 0 else {
                return ""
            }
            return Data(bytes: bytes, count: byteCount).base64EncodedString()
        default:
            return NSNull()
        }
    }

    private func normalizeSql(_ sql: String) -> String {
        sql
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .replacingOccurrences(
                of: "\\s*([(),=])\\s*",
                with: "$1",
                options: .regularExpression
            )
    }

    private func sqliteErrorMessage(_ database: OpaquePointer) -> String {
        guard let message = sqlite3_errmsg(database) else {
            return "unknown sqlite failure"
        }
        return String(cString: message)
    }

    private func failureMessage(_ prefix: String, _ error: Error) -> String {
        let detail = (error as NSError).localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if detail.isEmpty {
            return "\(prefix)。"
        }
        return "\(prefix)：\(detail)"
    }

    private enum LocalDataSqliteError: LocalizedError {
        case disallowedSql
        case invalidParams
        case sqlite(String)

        var errorDescription: String? {
            switch self {
            case .disallowedSql:
                return "LocalData SQLite 只允许仓库适配层声明的 SQL。"
            case .invalidParams:
                return "LocalData SQLite 参数格式不正确。"
            case .sqlite(let message):
                return message
            }
        }
    }
}
