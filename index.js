let canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let ctx = canvas.getContext("2d");

let player_height = 30;
let player_width = 30;
let margin = 100;

// TODO:
// * slicing animation
// * aiming up or down with melee weapon
// * ranged weapon
// * inflict damage
// * knockback

let players = [];
let ground = {
  x: 0,
  y: innerHeight-margin,
  width: innerWidth,
  height: margin,
  color: '#bebebe',
};
let gravity = 10;

let loopStarted = false;

window.addEventListener("gamepadconnected", (evt) => {
  let player = {
    dy: 2,
    y: innerHeight-margin-player_height,
    gamepad_ix: evt.gamepad.index,
    jump_btn_pressed: false,
    direction: 1
  };

  if (players.length) {
    player.x = innerWidth-margin-player_width;
    player.color = "#df0d0d";
  }
  else {
    player.x = margin;
    player.color = "#0dae4d";
  }

  players.push(player);

  draw();
});

function draw() {
  // draw the background
  ctx.fillStyle = "#333333";
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  // draw the ground
  ctx.fillStyle = ground.color;
  ctx.fillRect(ground.x, ground.y, ground.width, ground.height);
  
  // draw the players
  for (let player of players) {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x,player.y, player_width,player_height);
  }

  // draw players' weapons on top
  for (let player of players) {
    let {x, y} = player;
    if (player.direction > 0)
      x += player_width;
    else
      x -= player_width;
    let width = player_width;
    let height = player_height / 5;
    let angle = player.direction > 0 ? -30 : 30;

    ctx.fillStyle = player.color;
    ctx.save();
    ctx.translate(x + width/2, y + height/2); // origin of rotation on one side
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillRect(-width/2, -height/2, width, height); // draw rect centered at (0,0)
    ctx.restore();
  }
}

window.addEventListener("gamepaddisconnected", (evt) => {
  removeGamepad(evt.gamepad);
});

requestAnimationFrame(updateStatus);

function updateStatus() {
  requestAnimationFrame(updateStatus);
  let player = players[0];
  if (!player)
    return;

  // get inputs
  for (let gamepad of navigator.getGamepads()) {
    if (!gamepad) continue;

    let player = players.find(player => player.gamepad_ix == gamepad.index);
    for (const [i, axis] of gamepad.axes.entries()) {
      if (i == 0 && (axis > 0.2 || axis < -0.2))
        player.x += axis * 10;
      // i == 2 for dual-stick
      if (i == 0 && (axis > 0.2 || axis < -0.2))
        player.direction = axis > 0 ? 1 : -1;
    }

    for (const [i, button] of gamepad.buttons.entries()) {
      if (i == 0) {
        let is_touching_ground = player.y + player_height == ground.y;
        if (button.pressed && !player.jump_btn_pressed && is_touching_ground) {
          player.jump_btn_pressed = true;
          player.dy = -15;
        }
        else if (!button.pressed && player.jump_btn_pressed) {
          player.jump_btn_pressed = false;
        }
      }
      else if (i == 2) {
        if (button.pressed && !player.attack_btn_pressed) {
          player.attack_btn_pressed = true;
          for (let other_player of players)
            if (other_player != player && isInMeleeRange(other_player, player)) {
              if (other_player.x > player.x)
                other_player.x += 75;
              else
                other_player.x -= 75;
            }
        }
        else if (!button.pressed && player.attack_btn_pressed) {
          player.attack_btn_pressed = false;
        }
      }
    }
  }

  // updates
  for (let player of players) {
    if (player.dy < gravity)
      player.dy += 0.5;

    // handle collisions with the ground
    if (player.y + player_height + player.dy >= ground.y)
      player.y = ground.y - player_height;
    else
      player.y += player.dy;
  }

  draw();
}

function isInMeleeRange(other_player, player) {
  let is_vert_overlap = Math.abs(other_player.y - player.y) < player_width;
  let dist = other_player.x - player.x;
  if (player.direction == 1)
    return is_vert_overlap && dist < player_width && dist > 0;
  else
    return is_vert_overlap && dist > -player_width && dist < 0;
}
