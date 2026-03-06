
const sqlite = require('sqlite3').verbose();
const path = require('path')
dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite.Database(dbPath);

db.serialize(()=>{
    db.run(`
        CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL
        )
    `    
    );

    db.run(`
        CREATE TABLE IF NOT EXISTS friends(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        friend_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(friend_id) REFERENCES users(id)
        );
    `)

    db.run(`
        CREATE TABLE IF NOT EXISTS conversations(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1 INTEGER NOT NULL,
        user2 INTEGER NOT NULL,
        CONSTRAINT unique_chat UNIQUE (user1,user2) 
        )
    `)// Ważne!!! W Constraint Unique zezwala przyjmować wartosci np. 1,2 i 2,1 a nie ma to sensu w przypadku czatu dlatego przy wprowadzaniu istne będzie wprowadzać tak, aby były unikaty np. insert into ... values(min(user1_id,user2_id), max(user1_id,user2_id))

    db.run(`
        CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender INTEGER NOT NULL,
        content Text NOT NULL,
        timestamp INTEGER NOT NULL,
        conversation_id INTEGER NOT NULL
        )
    `)
})