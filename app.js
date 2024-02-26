

const express = require('express');
const app = express();
const { promisePool } = require('./db');
const path = require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'styles')));


app.get('/getTables', async (req, res) => {
    try {
        const [tables] = await promisePool.query(
            'SHOW TABLES FROM ??',
            [process.env.DB_DATABASE]
        );

        const tableNames = tables.map(row => Object.values(row)[0]);
        res.render('tableList', { tableNames });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/getTableData/:tableName', async (req, res) => {
    const tableName = req.params.tableName;

    try {
        if (!tableName) {
            throw new Error('Table name is required');
        }

        const [results] = await promisePool.query(`SELECT * FROM ${tableName}`);
        res.render('tableData', { tableName, data: results });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/allPets', async (req, res, next) => {
    try {
        const query = `
            SELECT 
                kucni_ljubimci.id_ljubimci,
                kucni_ljubimci.naziv AS ljubimac_naziv,
                kucni_ljubimci.datum_nabavke,
                kucni_ljubimci.datum_rodjenja,
                podkategorije_kucnih_ljubimaca.naziv AS podkategorija_naziv,
                kategorije_kucnih_ljubimaca.naziv AS kategorija_naziv
            FROM kucni_ljubimci
            JOIN podkategorije_kucnih_ljubimaca ON kucni_ljubimci.podkategorija_id = podkategorije_kucnih_ljubimaca.podkategorija_id
            JOIN kategorije_kucnih_ljubimaca ON podkategorije_kucnih_ljubimaca.kategorija_id = kategorije_kucnih_ljubimaca.kategorija_id
        `;

        const [pets] = await promisePool.query(query);

        res.render('allPets', { pets });
    } catch (error) {
        next(error);
    }
});

app.get('/petDetails/:petId', async (req, res, next) => {
    const petId = req.params.petId;

    try {
        const query = `
            SELECT *
            FROM PregledLjubimaca
            WHERE id_ljubimci = ?
        `;

        const [petDetails] = await promisePool.query(query, [petId]);

        res.render('petDetails', { petDetails: petDetails[0] });
    } catch (error) {
        next(error);
    }
});

app.get('/reportForm', (req, res) => {
    res.render('reportForm');
});


app.get('/generateReport/:reportType', async (req, res, next) => {
    const reportType = req.params.reportType;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    try {
        let query;

        switch (reportType) {
            case 'IzvjestajProdanihLjubimaca':
                query = 'CALL IzvjestajProdanihLjubimaca(?, ?)';
                break;
            case 'PregledNabavljenihLjubimacaPoDobavljacu':
                query = 'CALL PregledNabavljenihLjubimacaPoDobavljacu(?, ?)';
                break;
            case 'ZbirniPregledProdajeLjubimaca':
                query = 'CALL ZbirniPregledProdajeLjubimaca(?, ?)';
                break;
            default:
                throw new Error('Invalid report type');
        }

        const [reportResult] = await promisePool.query(query, [startDate, endDate]);

        res.render('reportResult', {  reportResult });
    } catch (error) {
        next(error);
    }
});

app.use(express.urlencoded({ extended: true }));

app.get('/form', (req, res) => {
    res.render('form');
});


app.post('/insertPricing', async (req, res, next) => {
    const { datumPromjene, napomena, idLjubimci, cijena } = req.body;

    try {
        // 1. Unesite podatke u tabelu 'zaglavlje_cjenovnika'
        const [insertedHeader] = await promisePool.query(
            'INSERT INTO zaglavlje_cjenovnika (datum_promjene, napomena) VALUES (?, ?)',
            [datumPromjene, napomena]
        );

        const idZaglavlje = insertedHeader.insertId;

        // 2. Unesite podatke u tabelu 'stavke_cjenovnika' sa povezanim ID-om
        await promisePool.query(
            'INSERT INTO stavke_cjenovnika (id_zaglavlje, id_ljubimci, cijena) VALUES (?, ?, ?)',
            [idZaglavlje, idLjubimci, cijena]
        );

        // Na kraju preusmerite na '/getTables'
        res.redirect('/getTables');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});




app.get('/supplierForm', async (req, res) => {
    try {
        // Pribavljanje podataka o dobavljačima iz baze podataka
        const [suppliers] = await promisePool.query('SELECT * FROM dobavljaci');

        // Prikazivanje forme sa podacima o dobavljačima
        res.render('supplierForm', { suppliers });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


app.post('/addSupplier', async (req, res) => {
    const { naziv, adresa } = req.body;

    try {
        await promisePool.query('INSERT INTO dobavljaci (naziv, adresa) VALUES (?, ?)', [naziv, adresa]);


        res.redirect('/supplierForm');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/updateSupplier/:supplierId', async (req, res) => {
    const supplierId = req.params.supplierId;
});


app.post('/deleteSupplier/:supplierId', async (req, res) => {
    const supplierId = req.params.supplierId;

    try {
        // Brisanje dobavljača iz baze podataka na osnovu ID-ja
        await promisePool.query('DELETE FROM dobavljaci WHERE id_dobavljaca = ?', [supplierId]);

        // Preusmeravanje na rutu sa pregledom dobavljača
        res.redirect('/supplierForm');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


