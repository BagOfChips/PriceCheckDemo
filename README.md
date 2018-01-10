![Easy Price Comparison](https://i.imgur.com/Xcb5mlm.png)  <br />
~~Check it out! https://compare-amazon-bestbuy.herokuapp.com/~~ <br />
NOTE: This project has been taken off Heroku due to [possible security issues](https://nodejs.org/en/blog/vulnerability/july-2017-security-releases/) with certain dependencies and is no longer maintained 
<br />
*Easy price comparison between Best Buy and Amazon products* <br />

## features
* Easy to navigate page split into 2 columns 
* Select your requested item and whenever it goes on sale, this service will send an email notification 
* Minimalistic, fast and responsive GUI

## demo
* The homepage will ask for your email - a cookie will store your session
* Searching for a product will query Best Buy and Amazon databases and display matching results in a 2 column view 
![page layout](https://i.imgur.com/pdqa6dQ.png)  <br />
* Users can input a price for a selected item
    * When that particular product goes on sale, the service will inform the user 

## dependencies
* Backend framework
    * Node.js / [Express.js](https://expressjs.com/)
* NPM modules
    * [sqlite3](https://www.npmjs.com/package/sqlite3) - simple local database 
    * [email-validator](https://www.npmjs.com/package/email-validator) - email validator; also simple way to prevent sql injection
    * [nodemailer](https://www.npmjs.com/package/nodemailer) - for sending email notifications 
    * [express-session](https://www.npmjs.com/package/express-session) - for cookies 
* Frontend  
    * [jQuery](https://jquery.com/)
    * [Bootstrap](https://getbootstrap.com/) - CSS framework 

## future plans
Recreate from scratch (this was my first Javascript project - self taught through googling various online resources). 
