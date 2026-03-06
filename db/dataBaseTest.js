import sqlite3 from "sqlite3"

const db = new sqlite3.Database('chat.db',(err)=>{
  if(err){
    console.error("Błąd połączenia z bazą",err.message)
  } else{
    console.error('Połączono z bazą')
  }
})

const sqlSearchUserName = "SELECT id,name FROM users WHERE name LIKE ? AND name <> ? AND users.id NOT IN (SELECT friend_id FROM friends WHERE friends.user_id = ? UNION SELECT user_id from friends WHERE friends.friend_id = ?)"
  db.all(sqlSearchUserName,["wojtek",'adam',1,1],(err,rows)=>{
    if(err){
      return res.status(500).send("Wystąpił błąd podczas próby pobrania danych z bazy")
    }
    rows.forEach(e=>{
      console.log(e.name + " " + e.id)
    })
  }
  )
const sql2 = "SELECT friend_id FROM friends WHERE friend_id = ? UNION SELECT user_id from friends WHERE user_id = ?"
db.all(sql2,[1,1],(err,rows)=>{
  if(err){
    return 
  }


  console.table(rows)

  const sqlGetPendingFriends = 'SELECT users.id, name FROM users JOIN friends ON users.id = friends.user_id WHERE friends.friend_id = ? AND friends.status = "pending"';
      db.all(sqlGetPendingFriends,[1],(err,rows)=>{
        if(err){
          console.log(`Wystapil blad przy zapytaniu! sqlGetPendingFriends ${err.message}`)
        }
        console.table(rows)
      })


  
  const sql2 = 'SELECT * from friends where friends.status = "pending"';
      db.all(sql2,[],(err,rows)=>{
        if(err){
          console.log(`Wystapil blad przy zapytaniu! sqlGetPendingFriends ${err.message}`)
        }
        console.table(rows)
      })

  const sql3 = "SHOW TABLES"  ;
  db.all(sql3,[],(err,rows)=>{
    if(err){
      console.log('NIE DIZALA')
    }
    console.table(rows)
  })  
})