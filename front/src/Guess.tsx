import React, { useState } from "react";
import { TextField, Typography } from "@material-ui/core";
import Canvas from "./Canvas";

const Guess = (props: any) => {
  const { oppData, onGuess, deviceIsSmall } = props;
  const [guess, setGuess] = useState("");
  const [inputValid, setInputValid] = useState({ guess: false });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e?.key === "Enter" || e?.code === "Enter" || e?.keyCode === 13) {
      inputValid.guess && onGuess(guess);
    }
  };

  const handleGuessChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const newGuess = e.target.value;
    setGuess(newGuess);
    setInputValid({ guess: !!newGuess });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        //border: "dashed",
        alignItems: "center",
        margin: "auto",
        padding: "70px 10px 50px 10px",
      }}
    >
      <div style={{ marginBottom: "50px" }}>
        <Typography variant="h5" noWrap>
          {oppData.name} drew this!
        </Typography>
      </div>
      <Canvas
        displayedHistory={oppData.pic}
        size={deviceIsSmall ? 300 : 500}
        locked
      />
      <div style={{ margin: "20px" }}>
        <Typography variant="h5" noWrap>
          What could it be? 🤔
        </Typography>
      </div>
      <TextField
        label="Your guess"
        variant="outlined"
        onKeyDown={handleKeyDown}
        value={guess}
        onChange={handleGuessChange}
        helperText={
          inputValid.guess
            ? "(press enter to lock in your guess)"
            : "Must be filled!"
        }
        error={!inputValid.guess}
      />
      <Typography
        variant="caption"
        noWrap
        style={{ visibility: guess ? "visible" : "hidden" }}
      >
        {false && "(press enter to lock in your guess)"}
      </Typography>
    </div>
  );
};

export default Guess;
