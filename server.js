const express = require('express');
const {Client,Pool} = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
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
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const mailOptions = {
    from: 'ruansantos80@gmail.com',
    to: 'goblinfuleiro@gmail.com',
    subject: 'Assunto do E-mail',
    text: 'Olá! Este é um e-mail enviado pelo Nodemailer.',
};




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
        nome VARCHAR(50) NOT NULL UNIQUE,
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
    const {user,senha} = req.body;

    const consulta = await pool.query(`SELECT * FROM usuarios WHERE nome = $1 OR email = $1`, [user]);
    if(consulta.rowCount <=0){
        res.send('Usuário ou senha inválidos!');
    }else{
        const valid_passwd = await bcrypt.compare(senha, consulta.rows[0].senha);
        if(valid_passwd){
            res.sendFile(path.join(__dirname,"Loginok.html"));
        }else{
            res.send('Usuário ou senha inválidos!');
        }
    }
       
    
})

app.post('/cadastrar',upload.none(),async (req,res)=>{
    const {nome,email,senha} = req.body
    const cripto = await gerarHash(senha);
    await pool.query(`INSERT INTO usuarios (nome,email,senha) VALUES ($1,$2,$3);`, [nome,email,cripto]);
    res.sendFile(path.join(__dirname,"Loginok.html"))
})



app.listen(port, () => {
    console.log('Server is running on port '+port);
    criaBanco().then(() => {
        criaTabela()
    });
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log('Erro ao enviar e-mail:', error);
        } else {
            console.log('E-mail enviado com sucesso:', info.response);
        }
    });
})