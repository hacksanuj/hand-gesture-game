///// HANDTRACK VARIABLES ////////

// get the video and canvas and set the context for the canvas
const video = document.getElementById("myvideo");
const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

// find the button and the update note to display other information
let trackButton = document.getElementById("trackbutton");
let updateNote = document.getElementById("updatenote");

let levelText = document.getElementById("levelText");

// some other variables in the script
let isVideo = false;
let model = null;

let filteredPreds = []; // init predictions to use elsewhere in the code

var contextLineWidth = "3";
var contextStrokeStyle = "black";

///// GAME VARIABLES ///////

const gameCanvas = document.getElementById("gameCanvas");
const cxt = gameCanvas.getContext("2d");

var framesPerSecond = 24;
var frame = 1;

// midpoint on the pred as marked by the dot relative to the canvas
var handPos = {
  x: 0,
  y: 0,
};

// scaled values for the hand
var handXScaled = 0;
var handYScaled = 0;

var newHand = false; // if a new hand detection is observed

// post of character on canvas
var spyPos = {
  x: 0,
  y: 0,
};

var spySize = 50;
/*
Obstacle and goal variables
x, y, width, height
*/
var obstaclePos = {};

// only one goal zone
var goalPos = {};

var goalSize = 50;

// with multiple lasers of just x y
var laserPos = {};

// laser animation direction toggles
var laser0xToggle = true;
var laser0yToggle = true;

var laser1xToggle = true;
var laser1yToggle = true;

var laser2xToggle = true;
var laser2yToggle = true;

var laser3xToggle = true;
var laser3yToggle = true;

/*
LEVELS
1: Tutorial level
2: Level with stationary obstacles
3: Level with moving obstacles (left right up down movement)
4: Level with moving obstacles advanced (follow? Rotate?)
*/
var level = 1;

// play, win, lose (display diff scene on canvas)
var gameState = "play";

//////////////////// HANDTRACK CODES /////////////////////////

// code from https://codepen.io/victordibia/pen/RdWbEY

/* 
object with the handtrack plugin configurations.
model params to be loaded into the tracking model to make it work properly
Apparently 0.5 makes for the fastest framerate on his demo site
Can reduce the number of boxes as we do not need more than 3 tbh (unless we make a two player segment)
*/
const modelParams = {
  flipHorizontal: true, // flip e.g for video
  maxNumBoxes: 20, // maximum number of boxes to detect
  iouThreshold: 0.5, // ioU threshold for non-max suppression
  scoreThreshold: 0.6, // confidence threshold for predictions.
};

// Function based off the handtrack helper methods in their library
function startVideo() {
  handTrack.startVideo(video).then(function (status) {
    console.log("video started", status);
    if (status) {
      // optional update of text on screen to indicate the tracking has started successfully
      updateNote.innerText = "Video started. Now tracking";
      isVideo = true;
      // runDetection defined in this script below
      runDetection();
    } else {
      // optional update of text on screen to indicate video is not enabled
      updateNote.innerText = "Please enable video";
    }
  });
}

// Function to toggle the starting and stopping of the video using library helper methods
function toggleVideo() {
  if (!isVideo) {
    updateNote.innerText = "Starting video";
    startVideo();
  } else {
    updateNote.innerText = "Stopping video";
    handTrack.stopVideo(video);
    isVideo = false;
    updateNote.innerText = "Video stopped";
  }
}

// Function to return the predictions as used above
function runDetection() {
  model.detect(video).then((predictions) => {
    //removing face and pinch labels

    filteredPreds = predictions.filter(
      (innerArray) =>
        innerArray.label !== "face" && innerArray.label !== "pinch"
    );

    model.renderPredictions(filteredPreds, canvas, context, video);

    // add movement area onto the camera feed
    context.beginPath();
    context.lineWidth = contextLineWidth;
    context.strokeStyle = contextStrokeStyle;
    context.strokeRect(100, 80, 400, 300);

    context.beginPath();
    context.fillStyle = "red";
    context.fillRect(spyPos.x / 2 + 100, spyPos.y / 2 + 80, 10, 10);

    if (isVideo) {
      // not sure how this call works
      requestAnimationFrame(runDetection);
    }
  });
}

// Load the model (note this function runs outside the functions (i think it only runs once?))
handTrack.load(modelParams).then((lmodel) => {
  // detect objects in the image
  model = lmodel;
  updateNote.innerText = "Loaded Model!";
  trackButton.disabled = false;
});

//////////////////// GAME LOGIC CODES /////////////////////////

// starting function
window.onload = function () {
  // note canvas context set above
  updateLevel();

  setInterval(function () {
    checkHand();
    moveEverything();
    drawEverything();

    // increment frame
    if (frame === 24) {
      frame = 1;
    } else {
      frame++;
    }
  }, 1000 / framesPerSecond);
};

// To render a image
function drawCustomImage(canvasCxt, imgSrc, x, y, width, height) {
  var customImage = new Image();
  customImage.src = imgSrc;
  canvasCxt.drawImage(customImage, x, y, width, height);
}

// for updating the position of images on the canvas
function moveEverything() {
  // update any moving obstacles for that level
  updateObstaclesAndLasers();

  // if there is new handpos to update spy pos
  if (newHand) {
    newhand = false;

    // if hand is within box
    if (
      handPos.x > 100 &&
      handPos.x < 500 &&
      handPos.y > 80 &&
      handPos.y < 380
    ) {
      contextStrokeStyle = "blue";

      handXScaled = Math.round((handPos.x - 100) * 2);
      handYScaled = Math.round((handPos.y - 80) * 2);

      // calculate euclidian dist
      distFromHand = Math.sqrt(
        Math.pow(spyPos.x - handXScaled, 2) +
          Math.pow(spyPos.y - handYScaled, 2)
      );
      // if within range of previous position (euclidian dist)
      if (distFromHand < 60) {
        // if goal advance level
        if (checkGoal()) {
          if (level !== 5) {
            level += 1;
            updateLevel();
          } else {
            spyPos.x = 0;
            spyPos.y = 0;
          }
        }

        // if hit laser for that level (laser are just lasers)
        else if (hitLaser()) {
        } else if (hitObstacle()) {
        } else {
          spyPos.x = handXScaled;
          spyPos.y = handYScaled;
        }
      }
    } else {
      contextStrokeStyle = "black";
    }
  }
}

// check if goal is reached
function checkGoal() {
  // check for overlap
  return boxHitSpy(
    goalPos.x,
    goalPos.y,
    goalSize,
    goalSize,
    handXScaled,
    handYScaled
  );
}

// check if one of the lasers
function hitLaser() {
  var hit = false;

  // iterate through lasers
  for (laser in laserPos) {
    hit =
      hit ||
      lineHitSpy(
        laserPos[laser].x1,
        laserPos[laser].y1,
        laserPos[laser].x2,
        laserPos[laser].y2,
        spyPos.x,
        spyPos.y
      );

    if (hit) {
      // reset position back to start
      updateLevel();
    }
  }

  //temp
  return hit;
}

function lineHitSpy(x1, y1, x2, y2, sx1, sy1) {
  // laser with left right top bottom of spy

  return (
    intersects(x1, y1, x2, y2, sx1, sy1, sx1, sy1 + spySize) ||
    intersects(
      x1,
      y1,
      x2,
      y2,
      sx1 + spySize,
      sy1,
      sx1 + spySize,
      sy1 + spySize
    ) ||
    intersects(x1, y1, x2, y2, sx1, sy1, sx1 + spySize, sy1) ||
    intersects(x1, y1, x2, y2, sx1, sy1 + spySize, sx1 + spySize, sy1 + spySize)
  );
}

function boxHitSpy(x, y, width, height, sx, sy) {
  // laser with left right top bottom of spy

  return (
    lineHitSpy(x, y, x, y + height, sx, sy) ||
    lineHitSpy(x + width, y, x + width, y + height, sx, sy) ||
    lineHitSpy(x, y, x + width, y, sx, sy) ||
    lineHitSpy(x, y + height, x + width, y + height, sx, sy)
  );
}

function restartLevel() {
  updateLevel();
}

// check if an obstacle overlaps
function hitObstacle() {
  // iterate through obstacles and check for collision
  var hit = false;

  for (var obstacle in obstaclePos) {
    var newHit = true;

    while (newHit) {
      // check if obstacle hit
      newHit = boxHitSpy(
        obstaclePos[obstacle].x,
        obstaclePos[obstacle].y,
        obstaclePos[obstacle].width,
        obstaclePos[obstacle].height,
        handXScaled,
        handYScaled
      );
      var hit = hit || newHit;

      var distX = 0;
      var distY = 0;

      if (newHit) {
        var directionMovedX = handXScaled - spyPos.x;
        if (directionMovedX > 0) {
          // moved right, now move left
          distX = obstaclePos[obstacle].x - spySize - handXScaled;
        } else {
          // moved left, now move right
          distX =
            obstaclePos[obstacle].x + obstaclePos[obstacle].width - handXScaled;
        }

        var directionMovedY = handYScaled - spyPos.y;
        if (directionMovedY > 0) {
          // moved down, now move up
          distY = obstaclePos[obstacle].y - spySize - handYScaled;
        } else {
          // moved up, now move down
          distY =
            obstaclePos[obstacle].y +
            obstaclePos[obstacle].height -
            handYScaled;
        }

        if (Math.abs(distX) < Math.abs(distY)) {
          handXScaled += distX;
        } else {
          handYScaled += distY;
        }
      }
    }
  }

  // then update the final position
  spyPos.x = handXScaled;
  spyPos.y = handYScaled;

  return hit;
}
// update the level, starting positions states and obstacle info
function updateLevel() {
  // update level
  levelText.innerText = "Level " + level;

  // laser animation direction toggles
  laser0xToggle = true;
  laser0yToggle = true;

  laser1xToggle = true;
  laser1yToggle = true;

  laser2xToggle = true;
  laser2yToggle = true;

  laser3xToggle = true;
  laser3yToggle = true;

  switch (level) {
    case 1:
      // gamestate
      // gameState = "play"

      // post of character on canvas
      spyPos = {
        x: 25,
        y: 50,
      };

      /*
            Obstacle and goal variables
            x, y, width, height
            */
      obstaclePos = {
        0: {
          x: 130,
          y: 0,
          width: 70,
          height: 300,
        },
        1: {
          x: 300,
          y: 140,
          width: 40,
          height: 460,
        },
        2: {
          x: 480,
          y: 350,
          width: 200,
          height: 80,
        },
        3: {
          x: 480,
          y: 0,
          width: 30,
          height: 350,
        },
      };

      // only one goal zone
      goalPos = {
        x: 640,
        y: 150,
      };

      // with multiple lasers of just x y
      laserPos = {};

      break;
    case 2:
      // gamestate
      // gameState = "play"

      // post of character on canvas
      spyPos = {
        x: 25,
        y: 500,
      };

      /*
            Obstacle and goal variables
            x, y, width, height
            */
      obstaclePos = {
        0: {
          x: 100,
          y: 100,
          width: 40,
          height: 500,
        },
        1: {
          x: 500,
          y: 140,
          width: 40,
          height: 460,
        },
        2: {
          x: 500,
          y: 100,
          width: 200,
          height: 40,
        },
      };

      // only one goal zone
      goalPos = {
        x: 700,
        y: 500,
      };

      // with multiple lasers of just x y
      laserPos = {
        0: {
          x1: 300,
          y1: 0,
          x2: 300,
          y2: 400,
        },
        1: {
          x1: 650,
          y1: 300,
          x2: 800,
          y2: 300,
        },
      };

      break;
    case 3: // gamestate
      // gameState = "play"

      // post of character on canvas
      spyPos = {
        x: 10,
        y: 520,
      };

      /*
        Obstacle and goal variables
        x, y, width, height
        */
      obstaclePos = {
        0: {
          x: 250,
          y: 0,
          width: 30,
          height: 450,
        },
        1: {
          x: 0,
          y: 0,
          width: 30,
          height: 450,
        },
        2: {
          x: 450,
          y: 90,
          width: 40,
          height: 510,
        },
        3: {
          x: 680,
          y: 0,
          width: 120,
          height: 210,
        },
        4: {
          x: 680,
          y: 300,
          width: 120,
          height: 210,
        },
      };

      // only one goal zone
      goalPos = {
        x: 725,
        y: 530,
      };

      // with multiple lasers of just x y
      laserPos = {
        0: {
          x1: 100,
          y1: 150,
          x2: 100,
          y2: 600,
        },
        1: {
          x1: 280,
          y1: 250,
          x2: 450,
          y2: 250,
        },
        2: {
          x1: 280,
          y1: 400,
          x2: 450,
          y2: 400,
        },
        3: {
          x1: 600,
          y1: 150,
          x2: 600,
          y2: 600,
        },
      };

      break;
    case 4:
      // gamestate
      // gameState = "play"

      // post of character on canvas
      spyPos = {
        x: 300,
        y: 50,
      };

      /*
            Obstacle and goal variables
            x, y, width, height
            */
      obstaclePos = {
        0: {
          x: 400,
          y: 0,
          width: 40,
          height: 500,
        },
        1: {
          x: 700,
          y: 140,
          width: 100,
          height: 460,
        },
      };

      // only one goal zone
      goalPos = {
        x: 700,
        y: 50,
      };

      // with multiple lasers of just x y
      laserPos = {
        0: {
          x1: 100,
          y1: 150,
          x2: 400,
          y2: 200,
        },
        1: {
          x1: 0,
          y1: 300,
          x2: 300,
          y2: 350,
        },
        2: {
          x1: 100,
          y1: 450,
          x2: 400,
          y2: 495,
        },
        3: {
          x1: 440,
          y1: 400,
          x2: 600,
          y2: 250,
        },
      };

      break;
    default:
    // win?
  }
}

// function to update obstacles for the animation
function updateObstaclesAndLasers() {
  // move based on previous position

  // check based on level
  switch (level) {
    case 3:
      // laser
      if (laser0xToggle) {
        if (laserPos[0].x1 < 210) {
          laserPos[0].x1 += 4;
        } else {
          laser0xToggle = !laser0xToggle;
        }
      } else {
        if (laserPos[0].x1 > 90) {
          laserPos[0].x1 -= 4;
        } else {
          laser0xToggle = !laser0xToggle;
        }
      }

      if (laser0yToggle) {
        if (laserPos[0].x2 < 210) {
          laserPos[0].x2 += 4;
        } else {
          laser0yToggle = !laser0yToggle;
        }
      } else {
        if (laserPos[0].x2 > 90) {
          laserPos[0].x2 -= 4;
        } else {
          laser0yToggle = !laser0yToggle;
        }
      }

      // laser 2
      if (laser1yToggle) {
        if (laserPos[1].x2 > 290) {
          laserPos[1].x2 -= 6;
        } else {
          laser1yToggle = !laser1yToggle;
        }
      } else {
        if (laserPos[1].x2 < 450) {
          laserPos[1].x2 += 6;
        } else {
          laser1yToggle = !laser1yToggle;
        }
      }

      // laser 3
      if (laser2yToggle) {
        if (laserPos[2].x1 < 450) {
          laserPos[2].x1 += 6;
        } else {
          laser2yToggle = !laser2yToggle;
        }
      } else {
        if (laserPos[2].x1 > 290) {
          laserPos[2].x1 -= 6;
        } else {
          laser2yToggle = !laser2yToggle;
        }
      }

      // laser 4
      if (laser3xToggle) {
        if (laserPos[3].x1 < 665) {
          laserPos[3].x1 += 4;
        } else {
          laser3xToggle = !laser3xToggle;
        }
      } else {
        if (laserPos[3].x1 > 500) {
          laserPos[3].x1 -= 4;
        } else {
          laser3xToggle = !laser3xToggle;
        }
      }

      if (laser2xToggle) {
        if (laserPos[3].x2 < 665) {
          laserPos[3].x2 += 4;
        } else {
          laser2xToggle = !laser2xToggle;
        }
      } else {
        if (laserPos[3].x2 > 500) {
          laserPos[3].x2 -= 4;
        } else {
          laser2xToggle = !laser2xToggle;
        }
      }
      break;
    case 4:
      // first laser
      if (laser0yToggle) {
        if (laserPos[0].y1 < 200) {
          laserPos[0].y1 += 3;
        } else {
          laser0yToggle = !laser0yToggle;
        }
      } else {
        if (laserPos[0].y1 > 100) {
          laserPos[0].y1 -= 3;
        } else {
          laser0yToggle = !laser0yToggle;
        }
      }

      if (laser0xToggle) {
        if (laserPos[0].x1 < 200) {
          laserPos[0].x1 += 4;
        } else {
          laser0xToggle = !laser0xToggle;
        }
      } else {
        if (laserPos[0].x1 > 100) {
          laserPos[0].x1 -= 4;
        } else {
          laser0xToggle = !laser0xToggle;
        }
      }

      // second laser
      if (laser1yToggle) {
        if (laserPos[1].y2 < 410) {
          laserPos[1].y2 += 3;
        } else {
          laser1yToggle = !laser1yToggle;
        }
      } else {
        if (laserPos[1].y2 > 250) {
          laserPos[1].y2 -= 3;
        } else {
          laser1yToggle = !laser1yToggle;
        }
      }

      if (laser1xToggle) {
        if (laserPos[1].x2 < 330) {
          laserPos[1].x2 += 4;
        } else {
          laser1xToggle = !laser1xToggle;
        }
      } else {
        if (laserPos[1].x2 > 250) {
          laserPos[1].x2 -= 4;
        } else {
          laser1xToggle = !laser1xToggle;
        }
      }

      // third laser
      if (laser2yToggle) {
        if (laserPos[2].y1 < 410) {
          laserPos[2].y1 += 3;
        } else {
          laser2yToggle = !laser2yToggle;
        }
      } else {
        if (laserPos[2].y1 > 520) {
          laserPos[2].y1 -= 3;
        } else {
          laser2yToggle = !laser2yToggle;
        }
      }

      if (laser2xToggle) {
        if (laserPos[2].x1 < 150) {
          laserPos[2].x1 += 4;
        } else {
          laser2xToggle = !laser2xToggle;
        }
      } else {
        if (laserPos[2].x1 > 50) {
          laserPos[2].x1 -= 4;
        } else {
          laser2xToggle = !laser2xToggle;
        }
      }

      //fourth laser
      if (laser3yToggle) {
        if (laserPos[3].y2 < 350) {
          laserPos[3].y2 += 5;
        } else {
          laser3yToggle = !laser3yToggle;
        }
      } else {
        if (laserPos[3].y2 > 200) {
          laserPos[3].y2 -= 5;
        } else {
          laser3yToggle = !laser3yToggle;
        }
      }

      if (laser3xToggle) {
        if (laserPos[3].x2 < 670) {
          laserPos[3].x2 += 4;
        } else {
          laser3xToggle = !laser3xToggle;
        }
      } else {
        if (laserPos[3].x2 > 550) {
          laserPos[3].x2 -= 4;
        } else {
          laser3xToggle = !laser3xToggle;
        }
      }
      break;
    default:
    // nothing for stationary levels 1 & 2
  }
}

// to render everything on the canvas for the new frame
function drawEverything() {
  if (level !== 5) {
    // draw bg
    drawCustomImage(cxt, "./images/background.png", 0, 0, 800, 600);

    // iterate through lasers
    for (var laser in laserPos) {
      drawLaser(
        laserPos[laser].x1,
        laserPos[laser].y1,
        laserPos[laser].x2,
        laserPos[laser].y2
      );
    }

    // iterate through obstacles
    for (var obstacle in obstaclePos) {
      drawObstacle(
        obstaclePos[obstacle].x,
        obstaclePos[obstacle].y,
        obstaclePos[obstacle].width,
        obstaclePos[obstacle].height
      );
    }

    // render goal
    drawCustomImage(
      cxt,
      "./images/blog.png",
      goalPos.x,
      goalPos.y,
      goalSize,
      goalSize
    );

    // render character
    drawCustomImage(
      cxt,
      "./images/robot.png",
      spyPos.x,
      spyPos.y,
      spySize,
      spySize
    );
  } else {
    drawCustomImage(cxt, "./images/winScreen.png", 0, 0, 800, 600);
  }
}

function drawLaser(x1, y1, x2, y2) {
  var gradient = cxt.createLinearGradient(0, 0, 600, 800);
  gradient.addColorStop("0", "magenta");
  gradient.addColorStop("0.5", "red");
  gradient.addColorStop("1.0", "pink");

  cxt.strokeStyle = gradient;
  cxt.lineWidth = 4;
  cxt.beginPath();
  cxt.moveTo(x1, y1);
  cxt.lineTo(x2, y2);
  cxt.stroke();
}

function drawObstacle(x, y, width, height) {
  cxt.beginPath();
  cxt.fillStyle = "black";
  cxt.fillRect(x, y, width, height);
}

// check if there is a new hand position and update
function checkHand() {
  // if theres just one hand
  if (filteredPreds.length === 1) {
    // calculate the center
    // bbox is x, y width, height

    handPos.x = filteredPreds[0].bbox[0] + filteredPreds[0].bbox[2] / 2;
    handPos.y = filteredPreds[0].bbox[1] + filteredPreds[0].bbox[3] / 2;

    // update that newHand detected is true
    newHand = true;
  }
}

// function to check for intersection between line segments
// https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
function intersects(a, b, c, d, p, q, r, s) {
  var det, gamma, lambda;
  det = (c - a) * (s - q) - (r - p) * (d - b);
  if (det === 0) {
    return false;
  } else {
    lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
    gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
    return 0 < lambda && lambda < 1 && 0 < gamma && gamma < 1;
  }
}
