let canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let ctx = canvas.getContext("2d");

let hurt_sounds = _.range(10).map(() => new Audio('hitHurt.wav'));
let shoot_sounds = _.range(10).map(() => new Audio('laserShoot.wav'));

let player_height = 30;
let player_width = 30;
let bullet_width = 7;
let bullet_height = 7;
let margin = 100;
let melee_damage = 10;
let ranged_damage = 5;

let num_platforms = _.random(4, 8);
let platforms = _.range(num_platforms).map(function() {
  let width = _.random(player_width * 4, innerWidth / 2);
  let y = _.random(player_height, innerHeight - margin - player_height);
  y -= y % player_height;
  return {
    height: player_height,
    width,
    x: _.random(0, innerWidth - width),
    y,
    color: '#bebebe'
  };
});

// ground
platforms.push({
  x: 0,
  y: innerHeight-margin,
  width: innerWidth,
  height: margin,
  color: '#bebebe',
});

// TODO:
// * don't allow platforms to be stacked on top of each-other
// * music
// * slicing animation
// * aiming up or down via left knob
// * taking damage animation (flashing white?)
// * powerups
// * game studio logo

let players = [];
let bullets = [];
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

  // draw platforms
  for (let platform of platforms) {
    ctx.fillStyle = platform.color;
    ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
  }
  
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
        let is_touching_platform = platforms.some(platform => player.y + player_height == platform.y);
        if (button.pressed && !player.jump_btn_pressed && is_touching_platform) {
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
              hurt_sounds.find(isNotPlaying)?.play();
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
          shoot_sounds.find(isNotPlaying)?.play();
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

    let player_goal = {...player, y: player.y + player.dy};
    let overlapping_platform = platforms.find(function(platform) {
      let player_was_above_platform = player.y + player.height <= platform.y;
      let is_overlapping = player.dy > 0 && player_was_above_platform && isOverlappingTop(player_goal, platform);
      return is_overlapping;
    });

    if (overlapping_platform)
      player.y = overlapping_platform.y - player_height;
    else
      player.y += player.dy;
  }


  let bullets_to_remove = [];
  for (let bullet of bullets) {
    bullet.x += 15 * bullet.direction;
    for (let player of players) {
      if (!isDead(player) && bullet.player_ix != player.ix && isOverlapping(player, bullet)) {
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
  return is_vert_overlap && is_facing_other_player && dist <= (player_width * 1.5);
}

function isDead(player) {
  return player.health <= 0;
}

function isOverlapping(rect1, rect2) {
  return getXOverlap(rect1, rect2) > 0 && getYOverlap(rect1, rect2) > 0;
}

function isOverlappingTop(rect1, rect2) {
  return getXOverlap(rect1, rect2) > 0 && rect1.y <= rect2.y && rect1.y + rect1.height >= rect2.y;
}

// the axis with the least overlap is the normal
function getNormalAxis(rect1, rect2) {
  return getXOverlap(rect1, rect2) < getYOverlap(rect1, rect2) ? 'x' : 'y';
}

function getXOverlap(rect1, rect2) {
  return Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x);
}

function getYOverlap(rect1, rect2) {
  return Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y);
}

function isPlaying(audio) {
  return audio.currentTime > 0 && !audio.paused && !audio.ended;
}

function isNotPlaying(audio) {
  return !isPlaying(audio);
}
