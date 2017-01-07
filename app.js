var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var bby = require('bestbuy')('');
var util = require('util'),
    OperationHelper = require('apac').OperationHelper;
var sqlite3 = require('sqlite3').verbose();
var nodemailer = require('nodemailer');
var validator = require('email-validator');
var session = require('express-session');
var connect = require('connect'),
    SQLiteStore = require('connect-sqlite3')(session);

var opHelper = new OperationHelper({
    awsId:     '',
    awsSecret: '',
    assocId:   'nodeapp-20'
});

var routes = require('./routes/index');
var search = require('./routes/search');

var users = require('./routes/users');

var app = express();

var mailOptions = {};
var sess;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// jan 1, sessions
app.use(session({secret: 'u7P<K^9L<Y)7,%c', resave: false, saveUninitialized: true, store: new SQLiteStore}));

app.use('/', routes);
app.use('/search', search);
app.use('/users', users);

app.get('/', function(req, res){
    sess = req.session;
    // reference - https://codeforgeek.com/2014/09/manage-session-using-node-js-express-4/
    res.render("index.ejs");
});

app.get('/sending-email', function(req, res){
    sess = req.session;
    //mailOptions.to = req.query.to;
    if(req.query.to == undefined || validator.validate(req.query.to) == false){
        res.send('<p>invalid email, try again</p>');
    }else{
        sess.email = req.query.to;
        res.end('done');
    }
});

// we will use a database to store
// user's email, selected item, and desired price
app.get('/sendPrice', function(req, res){
    sess = req.session;
    var userPrice = req.query.sendPrice;
    var upc = req.query.upc;

    if(!sess.email){
        // send user back to homepage
        console.log("here1");
        res.end('done');

    }else if(isNaN(userPrice) == true){
        // alert user to enter a number
        console.log("here2");
        res.send('NaN');

    }else if(sess.email != undefined && isNaN(userPrice) == false){
        // 2 emails are sent since browser makes 2 calls (1 for favicon.ico)

        var db = new sqlite3.Database('user_requests.db');
        // 1. make new gmail account
        // 2. get new credentials
        // 3. format mailOptions correctly
        // 4. run price check updates (not here)
        var smtpTransport = nodemailer.createTransport("SMTP", {
            service: "Gmail",
            auth: {
                XOAuth2: {
                    user: "PriceNotificationHere@gmail.com",
                    clientId: ".apps.googleusercontent.com",
                    clientSecret: "",
                    refreshToken: ""
                }
            }
        });

        /**
         sess.nameList = nameList;
         sess.priceList = priceList;
         sess.urlList = urlList;
         sess.upcList = upcList;
         */
        var productName;
        var currentPrice;
        var url;
        for(var i = 0; i < sess.upcList.length; i++){
            if(sess.upcList[i] == upc){
                productName = sess.nameList[i];
                currentPrice = sess.priceList[i];
                url = sess.urlList[i];

                mailOptions.to = sess.email;
                mailOptions.from = "PriceNotificationHere@gmail.com";
                mailOptions.subject = "Notification: " + productName;
                mailOptions.text = "Thanks for using Price Check Demo. " +
                    "We will notify you when your selected item: \"" + productName +
                    "\" goes on for sale less or equal to: " + userPrice + ". " +
                    "Its current price is: " + currentPrice + " on Best Buy.";

                smtpTransport.sendMail(mailOptions, function(error, response){
                    if(error){
                        console.log(error);
                    }else{
                        console.log(response);
                    }
                    smtpTransport.close();
                });

                db.serialize(function(){
                    db.run("CREATE TABLE IF NOT EXISTS users(" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "upc INTEGER," +
                        "email TEXT," +
                        "userPrice REAL);");

                    // we do not need to convert string -> double
                    db.run("INSERT INTO users(" +
                        "upc," +
                        "email," +
                        "userPrice) VALUES (" + upc + ", \"" + mailOptions.to + "\", " + userPrice + ");");
                });
                db.close();

                res.send('finish');
                // todo: alert user 'request received, we will alert you when your selected item's price drops'
            }
        }
    }
});

app.get('/searchItem', function(req, res){
    sess = req.session;
    // sessions work!
        // debugging fault, since different tabs of same browser share the same session
    //console.log(sess.email);

    var searchItem = req.query.searchItem;
    var parseSearch = searchItem.split(" ");
    var stringSearch = "(";
    for(var i = 0; i < parseSearch.length; i++){
        if(i > 0){
            stringSearch += "&search=" + parseSearch[i];
        }else{
            stringSearch += "search=" + parseSearch[i];
        }
    }
    stringSearch += ")";

    // bestbuy product attribute lists
    var nameList = [];
    var priceList = [];
    var urlList = [];
    var upcList = [];
    var upcString = '';

    // amazon product attribute lists
    var nameListAZ = [];
    var priceListAZ = [];
    var urlListAZ = [];
    var upcListAZ = [];

    // we are going to send this list back to our browser to display
    var searchResults = [];

    bby.products(stringSearch, {show: 'salePrice,name,upc,url', pageSize: 10})
        .then(function(data){
            if(data.products == undefined){
                res.send(searchResults);
            }else{
                if(data.total > 10){
                    data.total = 10;
                }
                for(var i = 0; i < data.total; i++){
                    var product = data.products[i];
                    nameList.push(product.name);
                    priceList.push(product.salePrice);
                    urlList.push(product.url);
                    upcList.push(product.upc);

                    upcString += product.upc;
                    if(i + 1 != data.total){
                        upcString += ',';
                    }
                }

                opHelper.execute('ItemLookup', {
                    'SearchIndex': 'All',
                    'IdType': 'UPC',
                    'ItemId': upcString,
                    'ResponseGroup': 'Medium'
                }).then(function(response){
                    //var keys = Object.keys(response.result.ItemLookupResponse.Items.Item[0].OfferSummary.LowestNewPrice.FormattedPrice);

                    for(var i = 0; i < upcList.length; i++){
                        var itemExists = response.result.ItemLookupResponse.Items.Item[i];
                        if(itemExists == undefined){

                            // we have a bad search - url not in amazon search database
                            // flag as -3 in attribute lists

                            nameListAZ.push(-3);
                            priceListAZ.push(-3);
                            urlListAZ.push(-3);
                            upcListAZ.push(-3);
                            continue;
                        }

                        var itemTitle = response.result.ItemLookupResponse.Items.Item[i].ItemAttributes.Title;
                        // dec. 29
                        // the following condition is necessary, look into it
                        if(response.result.ItemLookupResponse.Items.Item[i].OfferSummary.LowestNewPrice == undefined){
                            nameListAZ.push(-3);
                            priceListAZ.push(-3);
                            urlListAZ.push(-3);
                            upcListAZ.push(-3);
                            continue;
                        }
                        var lowestNewPrice = response.result.ItemLookupResponse.Items.Item[i].OfferSummary.LowestNewPrice.FormattedPrice;
                        // listPrice is no longer an ItemAttribute - dec 25, 2016
                        //var listPrice = response.result.ItemLookupResponse.Items.Item[i].ItemAttributes.ListPrice.FormattedPrice;
                        var amazonUrl = response.result.ItemLookupResponse.Items.Item[i].DetailPageURL;
                        var amazonUPC = response.result.ItemLookupResponse.Items.Item[i].ItemAttributes.UPC;

                        if(lowestNewPrice != undefined && lowestNewPrice.startsWith('$') && itemTitle != undefined && amazonUrl != undefined){

                            // price exists and is properly formatted
                            // append to attribute lists

                            nameListAZ.push(itemTitle);
                            priceListAZ.push(lowestNewPrice);
                            urlListAZ.push(amazonUrl);
                            upcListAZ.push(amazonUPC);
                        }else if(itemTitle != undefined && amazonUrl != undefined){

                            // item seems to exists
                            // price tag invalid
                            // append -1 to priceListAZ as a flag

                            nameListAZ.push(itemTitle);
                            priceListAZ.push(-1);
                            urlListAZ.push(amazonUrl);
                            upcListAZ.push(amazonUPC);
                        }else{

                            // bad product - no title, url, and likely no price
                            // append -2 to priceListAZ as a flag

                            nameListAZ.push(-2);
                            priceListAZ.push(-2);
                            urlListAZ.push(-2);
                            upcListAZ.push(-2);
                        }
                    }

                    // dec. 28
                    // we have to sort the lists first so every entry in each amazon list
                    // matches accordingly to every entry in each BB list
                    // get the upc of every amazon item first
                    for(var k = 0; k < upcList.length; k++){
                        for(var l = 0; l < upcListAZ.length; l++){
                            if(upcList[k] == upcListAZ[l] && k == l){
                                l = upcListAZ.length - 1;
                            }else if(upcList[k] == upcListAZ[l]){
                                // k does not equal l
                                // make temp variables and swap AZ[l <-> k]
                                var upcT = upcListAZ[l];
                                var nameT = nameListAZ[l];
                                var urlT = urlListAZ[l];
                                var priceT = priceListAZ[l];

                                upcListAZ[l] = upcListAZ[k];
                                nameListAZ[l] = nameListAZ[k];
                                urlListAZ[l] = urlListAZ[k];
                                priceListAZ[l] = priceListAZ[k];

                                upcListAZ[k] = upcT;
                                nameListAZ[k] = nameT;
                                urlListAZ[k] = urlT;
                                priceListAZ[k] = priceT;

                                l = upcListAZ.length - 1;
                            }
                        }
                    }
                    // note: there is probably a faster way to do this matching/sorting
                    // probably not that important since max length of list = 10

                    /**
                     // bestbuy product attribute lists
                     var nameList = [];
                     var priceList = [];
                     var urlList = [];
                     var upcList = [];
                     var upcString = '';

                     // amazon product attribute lists
                     var nameListAZ = [];
                     var priceListAZ = [];
                     var urlListAZ = [];
                     var upcListAZ = [];
                     */
                    sess.nameList = nameList;
                    sess.priceList = priceList;
                    sess.urlList = urlList;
                    sess.upcList = upcList;

                    for(var m = 0; m < nameList.length; m++){
                        if(nameList[m].length > 55){
                            nameList[m] = nameList[m].slice(0, 54);
                            nameList[m] += "...";
                        }
                        if(nameListAZ[m].length > 55){
                            nameListAZ[m] = nameListAZ[m].slice(0, 54);
                            nameListAZ[m] += "...";
                        }
                    }

                    // todo: put add price labels, also limit characters of each string to 60
                    for(var j = 0; j < upcList.length; j++){

                        // todo: send html segment inside container

                        // we can shorten this section by a couple dozen lines, but I'm gonna leave it as it is
                        // i.e, we can get rid of the flags in the lists and get rid of the following cases
                        // flags may be useful in future however
                        if(priceListAZ[j] == -1){
                            // we will have the first radio button checked
                            if(j == 0){
                                searchResults.push('<div class="row">');

                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<input type="radio" id="upc" name="item" value="' +
                                    upcList[j] +
                                    '" class="radiobutton" checked>' +
                                    '<label>' +
                                    '<a href="' + urlList[j] + '">' +
                                    " " + nameList[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">$' + priceList[j] + '</p></div>');

                                // test if label tag needed, check horizontal alignment
                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<label>' +
                                    '<a href="' + urlListAZ[j] + '">' +
                                    " " + nameListAZ[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">price unavailable</p></div></div>');
                            }else{
                                searchResults.push('<div class="row">');

                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<input type="radio" id="upc" name="item" value="' +
                                    upcList[j] +
                                    '" class="radiobutton">' +
                                    '<label>' +
                                    '<a href="' + urlList[j] + '">' +
                                    " " + nameList[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">$' + priceList[j] + '</p></div>');

                                // test if label tag needed, check horizontal alignment
                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<label>' +
                                    '<a href="' + urlListAZ[j] + '">' +
                                    " " + nameListAZ[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">price unavailable</p></div></div>');
                            }
                        }else if(priceListAZ[j] == -2 || priceListAZ[j] == -3){
                            // we will have the first radio button checked
                            if(j == 0){
                                searchResults.push('<div class="row">');

                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<input type="radio" id="upc" name="item" value="' +
                                    upcList[j] +
                                    '" class="radiobutton" checked>' +
                                    '<label>' +
                                    '<a href="' + urlList[j] + '">' +
                                    " " + nameList[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">$' + priceList[j] + '</p></div>');

                                // test if label tag needed, check horizontal alignment
                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<label>' +
                                    '<p style="font-style: italic">product unavailable</p>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">price unavailable</p></div></div>');
                            }else{
                                searchResults.push('<div class="row">');

                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<input type="radio" id="upc" name="item" value="' +
                                    upcList[j] +
                                    '" class="radiobutton">' +
                                    '<label>' +
                                    '<a href="' + urlList[j] + '">' +
                                    " " + nameList[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">$' + priceList[j] + '</p></div>');

                                // test if label tag needed, check horizontal alignment
                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<label>' +
                                    '<p style="font-style: italic">product unavailable</p>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">price unavailable</p></div></div>');
                            }
                        }else{
                            // we will have the first radio button checked
                            if(j == 0){
                                searchResults.push('<div class="row">');

                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<input type="radio" id="upc" name="item" value="' +
                                    upcList[j] +
                                    '" class="radiobutton" checked>' +
                                    '<label>' +
                                    '<a href="' + urlList[j] + '">' +
                                    " " + nameList[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">$' + priceList[j] + '</p></div>');

                                // test if label tag needed, check horizontal alignment
                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<label>' +
                                    '<a href="' + urlListAZ[j] + '">' +
                                    " " + nameListAZ[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">' + priceListAZ[j] + '</p></div></div>');
                            }else{
                                searchResults.push('<div class="row">');

                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<input type="radio" id="upc" name="item" value="' +
                                    upcList[j] +
                                    '" class="radiobutton">' +
                                    '<label>' +
                                    '<a href="' + urlList[j] + '">' +
                                    " " + nameList[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">$' + priceList[j] + '</p></div>');

                                // test if label tag needed, check horizontal alignment
                                searchResults.push('<div class="col-sm-6 col-md-6 col-lg-6">' +
                                    '<label>' +
                                    '<a href="' + urlListAZ[j] + '">' +
                                    " " + nameListAZ[j] +
                                    '</a>' +
                                    '</label>' +
                                    '<p style="padding-left: 3em">' + priceListAZ[j] + '</p></div></div>');
                            }
                        }
                    }
                    res.send(searchResults);

                }).catch(function(err){
                    console.error("amazon call failed: ", err);
                });
            }
        })
        .catch(function(err){
            console.warn(err);
        });
});

// catch 404 and forward to error handler
app.use(function(req, res, next){
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development'){
    app.use(function(err, req, res, next){
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next){
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
