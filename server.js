const express = require('express');
const {Client,Pool} = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
require('dotenv').config()

const app = express();
const port  = process.env.SRV_PORT
app.use(express.urlencoded({extended:true}));
const dbconfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
}
const pool = new Pool(dbconfig);
const saltRounds = process.env.SALT_ROUNDS*1;
const upload = multer()



async function criaBanco(){
    try{
        const client = new Client({
            user: dbconfig.user,
            host: dbconfig.host,
            password: dbconfig.password,
            port: dbconfig.port
        });
        await client.connect();
        const consulta = await client.query(`SELECT datname FROM pg_database WHERE datname = '${dbconfig.database}';`);
        if(consulta.rowCount == 0){
            console.log('Banco de dados não existe, criando...');
            await client.query(`CREATE DATABASE ${dbconfig.database};`);
            console.log('Banco de dados criado com sucesso!');
        }
        await client.end();
    }catch (error) {
        console.error('Erro ao criar o banco de dados:', error);
    }
}
async function criaTabela(){
    pool.query(`CREATE TABLE IF NOT EXISTS usuarios(
        id SERIAL,
        nome VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        senha VARCHAR(255) NOT NULL,
        CONSTRAINT pk_usuarios PRIMARY KEY (id)
    );`);
}

async function gerarHash(senha) {
    const hash = await bcrypt.hash(senha, saltRounds);
    return hash;
}

app.post('/login',async (req,res)=>{
    const {nome,senha} = req.body;
    const cripto = await gerarHash(senha);
    console.log(cripto);
    // const consulta = await pool.query(`SELECT * FROM usuarios WHERE nome = $1 AND senha = $2`, [nome,senha]);
    // if(consulta.rowCount <=0){
    //     res.send('Usuário ou senha inválidos!');
    // }else{
    //     res.sendFile(path.join(__dirname,'login.html'))
    // }
})

app.post('/cadastrar',upload.none(),async (req,res)=>{
    const {nome,email,senha} = req
    console.log(req.body);
    const cripto = await gerarHash(senha);
    console.log(cripto);
    /*await pool.query(`INSERT INTO usuarios (nome,email,senha) VALUES ($1,$2,$3);`, [nome,email,cripto]);
    res.send("cadastro realizado com sucesso!")*/
})



app.listen(port, () => {
    console.log('Server is running on port '+port);
    criaBanco().then(() => {
        criaTabela()
    });
})