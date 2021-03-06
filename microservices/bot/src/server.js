var request = require('request');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

let FACEBOOK_VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;
let FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
let FACEBOOK_SEND_MESSAGE_URL = 'https://graph.facebook.com/v2.6/me/messages?access_token=' + FACEBOOK_PAGE_ACCESS_TOKEN;

var memeInfo = {}; // stores required informaion for a meme

//your routes here
app.get('/', function (req, res) {
    res.send("Hello World, I am a bot.")
});

app.get('/webhook/', function(req, res) {
  if (req.query['hub.verify_token'] === FACEBOOK_VERIFY_TOKEN) {
        res.send(req.query['hub.challenge'])
        return;
    }
    res.send('Error, wrong token')
});  

app.post('/webhook/', function(req, res) {
  console.log(JSON.stringify(req.body));
  if (req.body.object === 'page') {
    if (req.body.entry) {
      req.body.entry.forEach(function(entry) {
        if (entry.messaging) {
          entry.messaging.forEach(function(messagingObject) {
              var senderId = messagingObject.sender.id;
              if (messagingObject.message) {
                if (!messagingObject.message.is_echo) {
                  if (messagingObject.message.attachments) {
                    // Conversation started. Store image
                    messagingObject.message.attachments.forEach(function(attachmentsObject) {
                      if (attachmentsObject.type === 'image') {
                        var image_url = attachmentsObject.payload.url;
                        storeMemeInfo(senderId, 'image_url', image_url); 
                      }                 
                    });
                  } else if(messagingObject.message.text) {
                  var text = messagingObject.message.text;
                  storeMemeInfo(senderId, 'text', text);
                  } else {
                    console.log('Invalid message');
                    sendMessageToUser(senderId,'Invalid response. Please try again');
                  } 
                }
              } else if (messagingObject.postback) {
                console.log('Received Postback message from ' + senderId);
              }
          });
        } else {
          console.log('Error: No messaging key found');
        }
      });
    } else {
      console.log('Error: No entry key found');
    }
  } else {
    console.log('Error: Not a page object');
  }
  res.sendStatus(200);
})

function storeMemeInfo(senderId, type, element) {
  if (type === 'text' && element.trim().toLowerCase() ==='.cancel') {
      delete memeInfo[senderId];
      sendMessageToUser(senderId, 'Attach an image to create a meme');
  
  } else if (!(senderId in memeInfo) && type === 'image_url') {   
    // store imageurl
    memeInfo[senderId] = new Object();
    memeInfo[senderId].image_url = element;
    console.log('Image Stored for ' + senderId);
    sendMessageToUser(senderId, 'Enter upper text to add to image');
  
  } else if (!(senderId in memeInfo) && type === 'text') {
    console.log('Text send instead of image '+ senderId);
    sendMessageToUser(senderId, 'Attach an image to create a meme');

  } else if (senderId in memeInfo && type === 'text' && !('text1' in memeInfo[senderId])) {
    // store text 1
    memeInfo[senderId].text1 = element;
    console.log('Text1 Stored for ' + senderId);
    sendMessageToUser(senderId, 'Enter lower text to add to image');
  } else if (senderId in memeInfo && type === 'text' && !('text2' in memeInfo[senderId]) ) {
    // store text 2
    memeInfo[senderId].text2 = element;
    console.log('Text2 Stored for ' + senderId);
    getMeme(senderId);

  } else {
    console.log("Invalid input")
    sendMessageToUser(senderId, 'Invalid Input Please try Again or type .cancel to start again');
  }
}

function sendImageToUser(senderId, image_url) {
  request({
    url: FACEBOOK_SEND_MESSAGE_URL,
    method: 'POST',
    json: {
      recipient: {
        id: senderId
      },
      message: {
        attachment: {
          type: 'image',
          payload: {
            url: image_url,
            is_reusable: true
          }
        }
      }
    }
  }, function(error, response, body) {
        if (error) {
          console.log('Error sending Image to user: ' + error.toString());
        } else if (response.body.error){
          console.log('Error sending Image to user: ' + JSON.stringify(response.body.error));
        }
  });
}

function sendMessageToUser(senderId, message) {
  request({
    url: FACEBOOK_SEND_MESSAGE_URL,
    method: 'POST',
    json: {
      recipient: {
        id: senderId
      },
      message: {
        text: message
      }
    }
  }, function(error, response, body) {
        if (error) {
          console.log('Error sending message to user: ' + error);
        } else if (response.body.error){
          console.log('Error sending message to user: ' + response.body.error);
        }
  });
}

function showTypingIndicatorToUser(senderId, isTyping) {
  var senderAction = isTyping ? 'typing_on' : 'typing_off';
  request({
    url: FACEBOOK_SEND_MESSAGE_URL,
    method: 'POST',
    json: {
      recipient: {
        id: senderId
      },
      sender_action: senderAction
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending typing indicator to user: ' + error);
    } else if (response.body.error){
      console.log('Error sending typing indicator to user: ' + response.body.error);
    }
  });
}



function encodeMemeText(val) {
  if(val === ""){
    val = " ";
  }
  val = val.toLowerCase();
  val = val.replace(/-/g, '--');
  val = val.replace(/_/g, '__');
  val = val.replace(/\s+/g, '_');
  val = val.replace(/\?/g, '~q');
  val = val.replace(/%/g, '~p');
  val = val.replace(/#/g, '~h');
  val = val.replace(/\//g, '~s');
  val = val.replace(/\"/g, '\'\'');
  return val;
}

function getMeme(senderId) {
  showTypingIndicatorToUser(senderId, true);
  sendMessageToUser(senderId, 'Here is your created meme');
  var image_url = memeInfo[senderId].image_url;
  //replace all '&' in image_url with %26
  image_url = image_url.replace(/&/g,'%26'); 
  var text1 = encodeMemeText( memeInfo[senderId].text1);
  var text2 = encodeMemeText( memeInfo[senderId].text2);
  var outputUrl = 'https://memegen.link/custom/' + text1 + '/' + text2 + '.jpg?alt=' + image_url;
  console.log('output url'+outputUrl);
  showTypingIndicatorToUser(senderId, false);
  sendImageToUser(senderId, outputUrl);
  delete memeInfo[senderId];
}



app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});
