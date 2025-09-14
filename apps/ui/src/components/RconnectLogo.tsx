import React from "react";

interface RconnectLogoProps {
  className?: string;
}

export const RconnectLogo: React.FC<RconnectLogoProps> = ({
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <svg
        width="49"
        height="44"
        viewBox="0 0 49 44"
        fill="none"
        className="fill-[#1A2735] dark:fill-white h-10 w-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M39.8904 19.3212L27.1788 6.6096C25.6993 5.13013 23.3007 5.13013 21.8212 6.6096L9.1096 19.3212C7.63013 20.8007 7.63013 23.1993 9.1096 24.6788L21.8212 37.3904C23.3007 38.8699 25.6993 38.8699 27.1788 37.3904L39.8904 24.6788C41.3699 23.1993 41.3699 20.8007 39.8904 19.3212Z"
          fill="current"
        />
        <path
          d="M26.6452 21.87H23.7362C23.1051 21.87 22.7636 22.6214 23.1727 23.1097L27.0625 27.7525C27.2031 27.9203 27.4091 28.017 27.626 28.017H30.5349C31.166 28.017 31.5075 27.2657 31.0984 26.7773L27.2086 22.1345C27.068 21.9667 26.862 21.87 26.6452 21.87Z"
          fill="#FFBF14"
        />
        <path
          d="M30.6404 16.6291C30.0813 15.9796 29.2735 15.6071 28.4244 15.6071H19.2359C18.3239 15.6071 17.5847 16.3584 17.5847 17.2852C17.5847 18.212 18.3239 18.9633 19.2359 18.9633H26.5861C27.2033 18.9633 27.794 19.2179 28.2231 19.6688L28.5057 19.9658C29.2485 20.7463 30.4803 20.7443 31.2205 19.9614C31.8983 19.2446 31.9241 18.1201 31.28 17.372L30.6404 16.6291Z"
          fill="#C4C7CA"
        />
        <path
          d="M17.54 23.6922C17.54 22.7576 18.2855 22 19.2051 22C20.1247 22 20.8702 22.7576 20.8702 23.6922V26.7007C20.8702 27.6353 20.1247 28.3929 19.2051 28.3929C18.2855 28.3929 17.54 27.6353 17.54 26.7007V23.6922Z"
          fill="#00A5AA"
        />
      </svg>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Built for developers by{" "}
        <a
          href="https://rconnect.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          rconnect.tech
        </a>
      </p>
    </div>
  );
};
