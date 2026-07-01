package com.alyssa.polaris;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteStatement;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "LocalDataSqlite")
public class LocalDataSqlitePlugin extends Plugin {
    private final ExecutorService sqliteExecutor = Executors.newSingleThreadExecutor();
    private SQLiteDatabase database;

    private static final String CREATE_ENTRIES_TABLE_SQL =
        "CREATE TABLE IF NOT EXISTS local_data_entries (" +
        " key TEXT PRIMARY KEY NOT NULL," +
        " value_json TEXT NOT NULL," +
        " updated_at INTEGER NOT NULL" +
        ")";
    private static final String READ_ENTRY_SQL =
        "SELECT value_json FROM local_data_entries WHERE key = ? LIMIT 1";
    private static final String LIST_KEYS_WITH_PREFIX_SQL =
        "SELECT key FROM local_data_entries WHERE substr(key, 1, ?) = ?";
    private static final String UPSERT_ENTRY_SQL =
        "INSERT INTO local_data_entries (key, value_json, updated_at) " +
        "VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET " +
        "value_json = excluded.value_json, " +
        "updated_at = excluded.updated_at";
    private static final String DELETE_ENTRY_SQL =
        "DELETE FROM local_data_entries WHERE key = ?";
    private static final String CREATE_CHAT_CONVERSATION_TABLE_SQL =
        "CREATE TABLE IF NOT EXISTS chat_conversation (" +
        " id TEXT PRIMARY KEY NOT NULL," +
        " title TEXT NOT NULL," +
        " kind TEXT NOT NULL," +
        " collaborator_id TEXT," +
        " group_room_id TEXT," +
        " active_project_id TEXT," +
        " pinned_at INTEGER," +
        " created_at INTEGER NOT NULL," +
        " updated_at INTEGER NOT NULL," +
        " metadata_json TEXT NOT NULL" +
        ")";
    private static final String CREATE_CHAT_MESSAGE_TABLE_SQL =
        "CREATE TABLE IF NOT EXISTS chat_message (" +
        " id TEXT PRIMARY KEY NOT NULL," +
        " conversation_id TEXT NOT NULL," +
        " seq INTEGER NOT NULL," +
        " role TEXT NOT NULL," +
        " content TEXT NOT NULL," +
        " reasoning TEXT NOT NULL," +
        " created_at INTEGER NOT NULL," +
        " updated_at INTEGER NOT NULL," +
        " payload_json TEXT NOT NULL," +
        " FOREIGN KEY(conversation_id) REFERENCES chat_conversation(id) ON DELETE CASCADE," +
        " UNIQUE(conversation_id, seq)" +
        ")";
    private static final String CREATE_CHAT_CONVERSATION_UPDATED_INDEX_SQL =
        "CREATE INDEX IF NOT EXISTS idx_chat_conversation_updated_at " +
        "ON chat_conversation(updated_at DESC, id ASC)";
    private static final String CREATE_CHAT_MESSAGE_CONVERSATION_SEQ_INDEX_SQL =
        "CREATE INDEX IF NOT EXISTS idx_chat_message_conversation_seq " +
        "ON chat_message(conversation_id, seq)";
    private static final String UPSERT_CHAT_CONVERSATION_SQL =
        "INSERT INTO chat_conversation (" +
        " id," +
        " title," +
        " kind," +
        " collaborator_id," +
        " group_room_id," +
        " active_project_id," +
        " pinned_at," +
        " created_at," +
        " updated_at," +
        " metadata_json" +
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "title = excluded.title, " +
        "kind = excluded.kind, " +
        "collaborator_id = excluded.collaborator_id, " +
        "group_room_id = excluded.group_room_id, " +
        "active_project_id = excluded.active_project_id, " +
        "pinned_at = excluded.pinned_at, " +
        "created_at = excluded.created_at, " +
        "updated_at = excluded.updated_at, " +
        "metadata_json = excluded.metadata_json";
    private static final String DELETE_CHAT_CONVERSATION_MESSAGES_SQL =
        "DELETE FROM chat_message WHERE conversation_id = ?";
    private static final String UPSERT_CHAT_MESSAGE_SQL =
        "INSERT INTO chat_message (" +
        " id," +
        " conversation_id," +
        " seq," +
        " role," +
        " content," +
        " reasoning," +
        " created_at," +
        " updated_at," +
        " payload_json" +
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "conversation_id = excluded.conversation_id, " +
        "seq = excluded.seq, " +
        "role = excluded.role, " +
        "content = excluded.content, " +
        "reasoning = excluded.reasoning, " +
        "created_at = excluded.created_at, " +
        "updated_at = excluded.updated_at, " +
        "payload_json = excluded.payload_json";
    private static final String READ_CHAT_CONVERSATION_SUMMARIES_SQL =
        "SELECT " +
        "c.id, " +
        "c.title, " +
        "c.kind, " +
        "c.collaborator_id, " +
        "c.group_room_id, " +
        "c.active_project_id, " +
        "c.pinned_at, " +
        "c.created_at, " +
        "c.updated_at, " +
        "COUNT(m.id) AS message_count, " +
        "COALESCE(MAX(m.updated_at), 0) AS latest_message_timestamp " +
        "FROM chat_conversation c " +
        "LEFT JOIN chat_message m ON m.conversation_id = c.id " +
        "GROUP BY " +
        "c.id, " +
        "c.title, " +
        "c.kind, " +
        "c.collaborator_id, " +
        "c.group_room_id, " +
        "c.active_project_id, " +
        "c.pinned_at, " +
        "c.created_at, " +
        "c.updated_at " +
        "ORDER BY c.updated_at DESC, c.id ASC";
    private static final String READ_CHAT_CONVERSATION_EXISTS_SQL =
        "SELECT id FROM chat_conversation WHERE id = ? LIMIT 1";
    private static final String READ_CHAT_CONVERSATION_METADATA_SQL =
        "SELECT metadata_json FROM chat_conversation WHERE id = ? LIMIT 1";
    private static final String READ_CHAT_MESSAGE_COUNT_SQL =
        "SELECT COUNT(*) AS message_count FROM chat_message WHERE conversation_id = ?";
    private static final String READ_RECENT_CHAT_MESSAGES_SQL =
        "SELECT seq, payload_json FROM chat_message " +
        "WHERE conversation_id = ? " +
        "ORDER BY seq DESC " +
        "LIMIT ?";
    private static final String READ_CHAT_MESSAGES_BEFORE_SEQ_SQL =
        "SELECT seq, payload_json FROM chat_message " +
        "WHERE conversation_id = ? AND seq < ? " +
        "ORDER BY seq DESC " +
        "LIMIT ?";

    private static final Set<String> ALLOWED_EXECUTE_SQL = new HashSet<>(Arrays.asList(
        normalizeSql(CREATE_ENTRIES_TABLE_SQL),
        normalizeSql(CREATE_CHAT_CONVERSATION_TABLE_SQL),
        normalizeSql(CREATE_CHAT_MESSAGE_TABLE_SQL),
        normalizeSql(CREATE_CHAT_CONVERSATION_UPDATED_INDEX_SQL),
        normalizeSql(CREATE_CHAT_MESSAGE_CONVERSATION_SEQ_INDEX_SQL),
        "BEGIN IMMEDIATE",
        "COMMIT",
        "ROLLBACK",
        normalizeSql(UPSERT_ENTRY_SQL),
        normalizeSql(DELETE_ENTRY_SQL),
        normalizeSql(UPSERT_CHAT_CONVERSATION_SQL),
        normalizeSql(DELETE_CHAT_CONVERSATION_MESSAGES_SQL),
        normalizeSql(UPSERT_CHAT_MESSAGE_SQL)
    ));
    private static final Set<String> ALLOWED_QUERY_SQL = new HashSet<>(Arrays.asList(
        normalizeSql(READ_ENTRY_SQL),
        normalizeSql(LIST_KEYS_WITH_PREFIX_SQL),
        normalizeSql(READ_CHAT_CONVERSATION_SUMMARIES_SQL),
        normalizeSql(READ_CHAT_CONVERSATION_EXISTS_SQL),
        normalizeSql(READ_CHAT_CONVERSATION_METADATA_SQL),
        normalizeSql(READ_CHAT_MESSAGE_COUNT_SQL),
        normalizeSql(READ_RECENT_CHAT_MESSAGES_SQL),
        normalizeSql(READ_CHAT_MESSAGES_BEFORE_SEQ_SQL)
    ));

    @PluginMethod
    public void execute(PluginCall call) {
        String sql = call.getString("sql");
        if (sql == null) {
            call.reject("缺少 LocalData SQLite SQL。");
            return;
        }
        JSArray params = call.getArray("params", new JSArray());

        sqliteExecutor.execute(() -> {
            try {
                String normalizedSql = normalizeSql(sql);
                if (!ALLOWED_EXECUTE_SQL.contains(normalizedSql)) {
                    throw new LocalDataSqliteException("LocalData SQLite 只允许仓库适配层声明的 SQL。");
                }
                SQLiteDatabase db = openDatabase();
                runStatement(db, normalizedSql, params);
                call.resolve();
            } catch (Exception error) {
                call.reject(failureMessage("执行 LocalData SQLite 写入失败", error), error);
            }
        });
    }

    @PluginMethod
    public void query(PluginCall call) {
        String sql = call.getString("sql");
        if (sql == null) {
            call.reject("缺少 LocalData SQLite SQL。");
            return;
        }
        JSArray params = call.getArray("params", new JSArray());

        sqliteExecutor.execute(() -> {
            try {
                String normalizedSql = normalizeSql(sql);
                if (!ALLOWED_QUERY_SQL.contains(normalizedSql)) {
                    throw new LocalDataSqliteException("LocalData SQLite 只允许仓库适配层声明的 SQL。");
                }
                SQLiteDatabase db = openDatabase();
                JSObject result = new JSObject();
                result.put("rows", runQuery(db, normalizedSql, params));
                call.resolve(result);
            } catch (Exception error) {
                call.reject(failureMessage("执行 LocalData SQLite 读取失败", error), error);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (database != null) {
            database.close();
            database = null;
        }
        sqliteExecutor.shutdown();
    }

    private SQLiteDatabase openDatabase() {
        if (database != null && database.isOpen()) {
            return database;
        }
        File directory = new File(getContext().getFilesDir(), "PolarisLocalDataSqlite");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new LocalDataSqliteException("无法创建 LocalData SQLite 目录。");
        }
        File file = new File(directory, "local-data.sqlite3");
        database = SQLiteDatabase.openOrCreateDatabase(file, null);
        database.setForeignKeyConstraintsEnabled(true);
        return database;
    }

    private void runStatement(SQLiteDatabase db, String sql, JSArray params) throws Exception {
        if ("BEGIN IMMEDIATE".equals(sql) || "COMMIT".equals(sql) || "ROLLBACK".equals(sql)) {
            db.execSQL(sql);
            return;
        }
        SQLiteStatement statement = db.compileStatement(sql);
        try {
            bindParams(statement, params);
            statement.execute();
        } finally {
            statement.close();
        }
    }

    private JSONArray runQuery(SQLiteDatabase db, String sql, JSArray params) throws Exception {
        JSONArray rows = new JSONArray();
        String[] selectionArgs = queryArgs(params);
        try (Cursor cursor = db.rawQuery(sql, selectionArgs)) {
            while (cursor.moveToNext()) {
                JSONObject row = new JSONObject();
                for (int index = 0; index < cursor.getColumnCount(); index += 1) {
                    row.put(cursor.getColumnName(index), cursorValue(cursor, index));
                }
                rows.put(row);
            }
        }
        return rows;
    }

    private void bindParams(SQLiteStatement statement, JSArray params) throws Exception {
        for (int index = 0; index < params.length(); index += 1) {
            Object value = params.get(index);
            int bindIndex = index + 1;
            if (value == null || value == JSONObject.NULL) {
                statement.bindNull(bindIndex);
            } else if (value instanceof Boolean) {
                statement.bindLong(bindIndex, Boolean.TRUE.equals(value) ? 1 : 0);
            } else if (value instanceof Integer || value instanceof Long) {
                statement.bindLong(bindIndex, ((Number) value).longValue());
            } else if (value instanceof Number) {
                statement.bindDouble(bindIndex, ((Number) value).doubleValue());
            } else if (value instanceof String) {
                statement.bindString(bindIndex, (String) value);
            } else {
                throw new LocalDataSqliteException("LocalData SQLite 参数格式不正确。");
            }
        }
    }

    private String[] queryArgs(JSArray params) throws Exception {
        String[] args = new String[params.length()];
        for (int index = 0; index < params.length(); index += 1) {
            Object value = params.get(index);
            if (value == null || value == JSONObject.NULL) {
                args[index] = null;
            } else if (value instanceof String) {
                args[index] = (String) value;
            } else if (value instanceof Number || value instanceof Boolean) {
                args[index] = String.valueOf(value);
            } else {
                throw new LocalDataSqliteException("LocalData SQLite 参数格式不正确。");
            }
        }
        return args;
    }

    private Object cursorValue(Cursor cursor, int index) {
        switch (cursor.getType(index)) {
            case Cursor.FIELD_TYPE_NULL:
                return JSONObject.NULL;
            case Cursor.FIELD_TYPE_INTEGER:
                return cursor.getLong(index);
            case Cursor.FIELD_TYPE_FLOAT:
                return cursor.getDouble(index);
            case Cursor.FIELD_TYPE_BLOB:
                return Base64.encodeToString(cursor.getBlob(index), Base64.NO_WRAP);
            case Cursor.FIELD_TYPE_STRING:
            default:
                return cursor.getString(index);
        }
    }

    private static String normalizeSql(String sql) {
        return sql
            .trim()
            .replaceAll("\\s+", " ")
            .replaceAll("\\s*([(),=])\\s*", "$1");
    }

    private static String failureMessage(String prefix, Exception error) {
        String detail = error.getMessage();
        if (detail == null || detail.trim().isEmpty()) {
            return String.format(Locale.ROOT, "%s。", prefix);
        }
        return String.format(Locale.ROOT, "%s：%s", prefix, detail.trim());
    }

    private static class LocalDataSqliteException extends RuntimeException {
        LocalDataSqliteException(String message) {
            super(message);
        }
    }
}
