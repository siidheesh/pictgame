import React, { useState } from "react";
import { TextField, Typography, useMediaQuery } from "@material-ui/core";
import Canvas from "./Canvas";

const Guess = (props: any) => {
  const { oppData, onGuess } = props;
  const [guess, setGuess] = useState("");
  const [inputValid, setInputValid] = useState({ guess: false });
  const deviceIsSmall = useMediaQuery("(max-width:600px)", { noSsr: true });

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
    <div className="center header-padding">
      <div className="mb50">
        <Typography variant="h5" noWrap>
          {oppData.name} drew this!
        </Typography>
      </div>
      <Canvas
        displayedHistory={oppData.pic}
        size={deviceIsSmall ? 300 : 500}
        locked
      />
      <div className="m20">
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
    </div>
  );
};

export default Guess;
