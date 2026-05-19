import ReactMarkdown
from "react-markdown";

import remarkGfm
from "remark-gfm";

const SectionBlock = ({
  title,
  children,
}) => {

  let glow = "";

  if (
    title.includes(
      "Key"
    )
  ) {
    glow =
      "from-cyan-500/10 to-blue-500/10";
  }

  else if (
    title.includes(
      "Important"
    )
  ) {
    glow =
      "from-purple-500/10 to-pink-500/10";
  }

  else if (
    title.includes(
      "Definition"
    )
  ) {
    glow =
      "from-green-500/10 to-emerald-500/10";
  }

  else {

    glow =
      "from-white/5 to-white/5";
  }

  return (

    <div
      className={`
        my-8
        rounded-3xl
        border border-white/10
        bg-gradient-to-br
        ${glow}
        p-5 sm:p-7
        backdrop-blur-xl
      `}
    >

      <h2
        className="
          text-xl sm:text-2xl
          font-bold
          mb-5
          text-white
        "
      >
        {title}
      </h2>

      <div>
        {children}
      </div>

    </div>
  );
};

const ResponseViewer = ({
  content,
}) => {

  return (

    <div
      className="
      max-w-none
      text-gray-200
    "
    >

      <ReactMarkdown

        remarkPlugins={[
          remarkGfm,
        ]}

        components={{

          h1: ({
            children,
          }) => (

            <SectionBlock
              title={
                children?.toString()
              }
            >

              <div />

            </SectionBlock>
          ),

          h2: ({
            children,
          }) => (

            <h2
              className="
                text-xl sm:text-3xl
                font-semibold
                text-cyan-200
                mt-10 mb-5
              "
            >
              {children}
            </h2>
          ),

          h3: ({
            children,
          }) => (

            <h3
              className="
                text-lg sm:text-2xl
                font-medium
                text-white
                mt-8 mb-4
              "
            >
              {children}
            </h3>
          ),

          p: ({
            children,
          }) => (

            <p
              className="
                leading-8
                text-gray-300
                mb-5
                text-[15px]
                sm:text-base
              "
            >
              {children}
            </p>
          ),

          ul: ({
            children,
          }) => (

            <ul
              className="
                space-y-3
                ml-4
                mb-6
                list-disc
                marker:text-cyan-400
              "
            >
              {children}
            </ul>
          ),

          li: ({
            children,
          }) => (

            <li
              className="
                leading-7
                text-gray-300
              "
            >
              {children}
            </li>
          ),

          strong: ({
            children,
          }) => (

            <strong
              className="
                text-white
                font-semibold
              "
            >
              {children}
            </strong>
          ),

          blockquote: ({
            children,
          }) => (

            <blockquote
              className="
                border-l-4
                border-cyan-400
                pl-4
                italic
                text-gray-400
                my-6
              "
            >
              {children}
            </blockquote>
          ),
        }}
      >

        {content}

      </ReactMarkdown>

    </div>
  );
};

export default ResponseViewer;