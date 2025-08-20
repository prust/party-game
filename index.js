let canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let ctx = canvas.getContext("2d");

let player_height = 30;
let player_width = 30;
let bullet_width = 7;
let bullet_height = 7;
let margin = 100;
let melee_damage = 5;
let ranged_damage = 5;

// TODO:
// * slicing animation
// * aiming up or down via left knob
// * ranged weapon
// * inflict damage - flashing or white
// * health (# lives or hits)

let players = [];
let bullets = [];
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
    direction: 1,
    health: 100,
    melee_btn_pressed: false,
    ranged_btn_pressed: false,
    width: player_width,
    height: player_height,
  };

  if (players.length) {
    player.x = innerWidth-margin-player_width;
    player.color = "#df0d0d";
    player.ix = 1;
  }
  else {
    player.x = margin;
    player.color = "#0dae4d";
    player.ix = 0;
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
    // don't draw dead players
    if (isDead(player))
      continue;

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x,player.y, player_width,player_height);
  }

  // draw bullets behind players & melee weapons
  for (let bullet of bullets) {
    ctx.fillStyle = bullet.color;
    ctx.fillRect(bullet.x, bullet.y, bullet_width, bullet_height);
  }

  // draw players' weapons on top
  for (let player of players) {
    // don't draw dead players
    if (isDead(player))
      continue;

    ctx.fillStyle = player.color;

    // draw health bar
    let bar_width = player_width * 8 * player.health / 100;
    if (player.ix == 0)
      ctx.fillRect(player_width, player_height, bar_width, player_height);
    else if (player.ix == 1)
      ctx.fillRect(canvas.width - bar_width - player_width, player_height, bar_width, player_height);

    let {x, y} = player;
    if (player.direction > 0)
      x += player_width;
    else
      x -= player_width;
    let width = player_width;
    let height = player_height / 5;
    let angle = player.direction > 0 ? -30 : 30;

    
    ctx.save();
    ctx.translate(x + width/2, y + height/2); // origin of rotation on one side
    ctx.rotate(angle * Math.PI / 180);
    ctx.fillRect(-width/2, -height/2, width, height); // draw rect centered at (0,0)
    ctx.restore();
  }

  let live_players = players.filter(player => !isDead(player));
  if (players.length > 1 && live_players.length == 1) {
    ctx.font = "100px sans-serif";
    ctx.fillStyle = live_players[0].color;
    ctx.fillText(`Player ${live_players[0].ix + 1} wins!`, canvas.width / 3, canvas.height / 3);
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
      else if (i == 2 && !isDead(player)) {
        if (button.pressed && !player.melee_btn_pressed) {
          player.melee_btn_pressed = true;
          for (let other_player of players)
            if (other_player != player && isInMeleeRange(other_player, player)) {
              other_player.health -= melee_damage;
              if (other_player.x > player.x)
                other_player.x += 75;
              else
                other_player.x -= 75;
            }
        }
        else if (!button.pressed && player.melee_btn_pressed) {
          player.melee_btn_pressed = false;
        }
      }
      else if (i == 7 && !isDead(player)) {
        if (button.pressed && !player.ranged_btn_pressed) {
          player.ranged_btn_pressed = true;
          bullets.push({player_ix: player.ix, color: player.color, x: player.x, y: player.y, width: bullet_width, height: bullet_height, direction: player.direction});
        }
        else if (!button.pressed && player.ranged_btn_pressed) {
          player.ranged_btn_pressed = false;
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

  let bullets_to_remove = [];
  for (let bullet of bullets) {
    bullet.x += 15 * bullet.direction;
    for (let player of players) {
      if (isOverlapping(player, bullet)) {
        player.health -= ranged_damage;
        bullets_to_remove.push(bullet);
      }
    }
  }

  for (let bullet of bullets_to_remove)
    bullets.splice(bullets.indexOf(bullet), 1);

  draw();
}

function isInMeleeRange(other_player, player) {
  let is_vert_overlap = Math.abs(other_player.y - player.y) < player_width;
  // to get dist *between* take the x diff (left-most points) and subtract player width
  let dist = Math.abs(other_player.x - player.x) - player_width;
  let is_facing_other_player;
  if (player.direction == 1)
    is_facing_other_player = other_player.x >= player.x;
  else
    is_facing_other_player = other_player.x <= player.x;
  return is_vert_overlap && is_facing_other_player && dist < player_width;
}

function isDead(player) {
  return player.health <= 0;
}

function isOverlapping(rect1, rect2) {
  return !(rect2.x > (rect1.x + rect1.width) || 
           (rect2.x + rect2.width) < rect1.x || 
           rect2.y > (rect1.y + rect1.height) || 
           (rect2.y + rect2.height) < rect1.y);
}