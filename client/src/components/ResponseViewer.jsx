import ReactMarkdown
from "react-markdown";

import remarkGfm
from "remark-gfm";

const getSectionStyle =
(title = "") => {

  const lower =
    title.toLowerCase();

  if (
    lower.includes("overview")
  ) {

    return `
      border-cyan-500/10
      bg-cyan-500/[0.03]
    `;
  }

  if (
    lower.includes("important")
  ) {

    return `
      border-purple-500/10
      bg-purple-500/[0.03]
    `;
  }

  if (
    lower.includes("revision")
  ) {

    return `
      border-green-500/10
      bg-green-500/[0.03]
    `;
  }

  return `
    border-white/5
    bg-white/[0.02]
  `;
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
          }) => {

            const title =
              children?.toString();

            return (

              <div
                className={`
                  mt-6 mb-4
                  rounded-2xl
                  border
                  px-4 sm:px-5
                  py-3 sm:py-4
                  backdrop-blur-lg
                  ${getSectionStyle(title)}
                `}
              >

                <h1
                  className="
                    text-lg sm:text-2xl
                    font-semibold
                    tracking-tight
                    text-white
                    leading-tight
                  "
                >
                  {children}
                </h1>

              </div>
            );
          },

          h2: ({
            children,
          }) => (

            <h2
              className="
                text-base sm:text-xl
                font-semibold
                text-cyan-200
                mt-6 mb-3
                tracking-tight
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
                text-sm sm:text-lg
                font-medium
                text-white
                mt-5 mb-2
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
                leading-7
                text-gray-300
                mb-4
                text-[14px]
                sm:text-[15px]
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
                space-y-2
                ml-5
                mb-5
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
                text-[14px]
                sm:text-[15px]
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
                border-l-2
                border-cyan-400/40
                pl-4
                italic
                text-gray-400
                my-5
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